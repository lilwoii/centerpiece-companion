#include "SkinStudioDeviceBuilder.h"
#include "SkinCreatorLibrary.h"
#include "KeyEventReceiver.h"
#include "Materials/MaterialParameterCollection.h"
#include "Kismet/KismetMaterialLibrary.h"
#include "Kismet/GameplayStatics.h"
#include "Kismet/KismetMathLibrary.h"
#include "Kismet/KismetSystemLibrary.h"
#include "Kismet/KismetStringLibrary.h"
#include "Kismet/KismetTextLibrary.h"
#include "Components/TextRenderComponent.h"
#include "Components/SceneComponent.h"
#include "Engine/Font.h"
#include "Engine/Texture2D.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "EngineUtils.h"
#include "Editor.h"
#include "Engine/SceneCapture2D.h"
#include "Components/SceneCaptureComponent2D.h"
#include "Engine/TextureRenderTarget2D.h"
#include "ImageUtils.h"
#include "Misc/FileHelper.h"
#include "RenderingThread.h"
#include "ShaderCompiler.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"
#include "Materials/MaterialInterface.h"
#include "Materials/Material.h"
#include "MaterialShared.h"
#include "Engine/SimpleConstructionScript.h"
#include "Engine/SCS_Node.h"
#include "K2Node_VariableGet.h"
#include "K2Node_VariableSet.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Engine/Blueprint.h"
#include "Engine/BlueprintGeneratedClass.h"
#include "UObject/UnrealType.h"
#include "GameFramework/Actor.h"
#include "EdGraphSchema_K2.h"
#include "K2Node_Event.h"
#include "K2Node_CustomEvent.h"
#include "K2Node_CallFunction.h"
#include "K2Node_AddDelegate.h"
#include "K2Node_IfThenElse.h"
#include "AssetRegistryModule.h"
#include "Modules/ModuleManager.h"
IMPLEMENT_MODULE(FDefaultModuleImpl,SkinStudioDeviceBuilder)
namespace
{
template<typename T>T* Node(UEdGraph* Graph,int32 X,int32 Y){auto* N=NewObject<T>(Graph);Graph->AddNode(N,false,false);N->CreateNewGuid();N->NodePosX=X;N->NodePosY=Y;return N;}
UK2Node_CallFunction* Call(UEdGraph* Graph,UClass* Class,const TCHAR* Name,int32 X,int32 Y){auto* N=Node<UK2Node_CallFunction>(Graph,X,Y);N->SetFromFunction(Class->FindFunctionByName(Name));N->AllocateDefaultPins();return N;}
bool Wire(UEdGraph* G,UEdGraphNode* A,const TCHAR* Out,UEdGraphNode* B,const TCHAR* In){auto* P=A->FindPin(Out);auto* Q=B->FindPin(In);return P&&Q&&GetDefault<UEdGraphSchema_K2>()->TryCreateConnection(P,Q);}
void Parameter(UK2Node_CallFunction* N,UMaterialParameterCollection* Collection,const TCHAR* Name){N->FindPin(TEXT("Collection"))->DefaultObject=Collection;N->FindPin(TEXT("ParameterName"))->DefaultValue=Name;}
}
bool USkinStudioDeviceBuilder::PrepareFontPages(UFont* Font)
{
    // Font pages are intentionally not exposed for Python editor mutation.
    // Work only on our fresh copied font and preserve its character/page map.
    if(!Font||Font->GetPathName()!=TEXT("/Game/Companion/Fonts/StudioFont.StudioFont")||Font->Textures.Num()==0)return false;
    for(int32 I=0;I<Font->Textures.Num();I++)
    {
        auto* Page=Font->Textures[I];if(!Page)return false;
        if(Page->GetOutermost()!=Font->GetOutermost())
        {
            Page=DuplicateObject<UTexture2D>(Page,Font,FName(*FString::Printf(TEXT("FontPage_%02d"),I)));
            if(!Page)return false;Font->Textures[I]=Page;
        }
    }
    Font->MarkPackageDirty();return true;
}
AActor* USkinStudioDeviceBuilder::SpawnDeviceActor(TSubclassOf<AActor> ActorClass,FVector Location,FRotator Rotation)
{
    // The editor placement library requires a viewport and crashes in a
    // headless Python commandlet. Spawn directly into our fixed entry world.
    UWorld* World=GEditor?GEditor->GetEditorWorldContext().World():nullptr;
    if(!World||World->GetOutermost()->GetName()!=TEXT("/Game/map/M_EntryPoint")||!ActorClass)return nullptr;
    FActorSpawnParameters Params;Params.OverrideLevel=World->PersistentLevel;Params.ObjectFlags=RF_Transactional;Params.SpawnCollisionHandlingOverride=ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    return World->SpawnActor<AActor>(ActorClass.Get(),Location,Rotation,Params);
}
FString USkinStudioDeviceBuilder::RunLayerSmokeTest(TSubclassOf<AActor> ActorClass)
{
    // Runs generated Blueprint VM code in a temporary local world. It never
    // changes the editor map, opens hardware, or asserts firmware compatibility.
    if(!GEngine||!ActorClass)return TEXT("{\"error\":\"Choose a generated class.\"}");
    const bool Diagnostic=ActorClass->GetPathName()==TEXT("/Game/Companion/BP_KeyboardInput.BP_KeyboardInput_C");
    if(!Diagnostic&&!ActorClass->GetPathName().StartsWith(TEXT("/Game/Companion/BP_Layer_")))return TEXT("{\"error\":\"Choose a generated layer class.\"}");
    UWorld* World=UWorld::CreateWorld(EWorldType::Game,false,FName(TEXT("StudioRuntimeSmoke")));
    if(!World)return TEXT("{\"error\":\"Test world could not be created.\"}");
    FWorldContext& Context=GEngine->CreateNewWorldContext(EWorldType::Game);Context.SetCurrentWorld(World);
    FActorSpawnParameters Params;Params.SpawnCollisionHandlingOverride=ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    AActor* Actor=World->SpawnActor<AActor>(ActorClass.Get(),FVector::ZeroVector,FRotator::ZeroRotator,Params);
    TSharedRef<FJsonObject> Report=MakeShared<FJsonObject>();Report->SetBoolField(TEXT("hardwareVerified"),false);
    if(Actor)
    {
        USkinCreatorLibrary::SetPreviewReceiverAvailableForTests(false);World->InitializeActorsForPlay(FURL());Actor->DispatchBeginPlay();
        // Exercise registered actor ticks through the engine scheduler; calling
        // Actor->Tick directly would hide an accidentally disabled runtime tick.
        auto Step=[&](float Delta){++GFrameCounter;World->Tick(LEVELTICK_All,Delta);};
        Report->SetBoolField(TEXT("tickRegistered"),Actor->PrimaryActorTick.IsTickFunctionRegistered()&&Actor->IsActorTickEnabled());
        auto FloatValue=[&](const TCHAR* Name){auto* P=FindFProperty<FFloatProperty>(Actor->GetClass(),Name);return P?P->GetPropertyValue_InContainer(Actor):-10000.f;};
        auto VectorValue=[&](const TCHAR* Name){auto* P=FindFProperty<FStructProperty>(Actor->GetClass(),Name);return P&&P->Struct==TBaseStructure<FVector>::Get()?*P->ContainerPtrToValuePtr<FVector>(Actor):FVector::ZeroVector;};
        Step(.1f);auto* BoundProperty=FindFProperty<FBoolProperty>(Actor->GetClass(),TEXT("InputBound"));Report->SetBoolField(TEXT("waitedForInput"),BoundProperty&&!BoundProperty->GetPropertyValue_InContainer(Actor));USkinCreatorLibrary::SetPreviewReceiverAvailableForTests(true);Step(.05f);Report->SetBoolField(TEXT("lateInputConnected"),BoundProperty&&BoundProperty->GetPropertyValue_InContainer(Actor));const FVector First=Actor->GetActorLocation();for(int32 I=0;I<10;I++)Step(.05f);const FVector Before=Actor->GetActorLocation();
        Report->SetNumberField(TEXT("idleDistance"),FVector::Dist(First,Before));
        if(Diagnostic)
        {
            auto* Text=Actor->FindComponentByClass<UTextRenderComponent>();
            Report->SetBoolField(TEXT("readyTextUpdated"),Text&&Text->Text.ToString()==TEXT("TEST READY | INPUT CONNECTED"));
            USkinCreatorLibrary::SetPreviewPositionForTests(FVector2D(480,123));
            auto* Receiver=USkinCreatorLibrary::GetKeyEventReceiver();Receiver->OnKeyEvent.Broadcast(37,true,73);
            const FString Result=Text?Text->Text.ToString():TEXT("");
            Report->SetStringField(TEXT("keyText"),Result);Report->SetBoolField(TEXT("keyTextUpdated"),Result.Contains(TEXT("HCode: 37"))&&Result.Contains(TEXT("480"))&&Result.Contains(TEXT("123")));
            Receiver->OnKeyEvent.Broadcast(37,false,0);
        }
        else if(FindFProperty<FFloatProperty>(Actor->GetClass(),TEXT("GPrism")))
        {
            auto* Receiver=USkinCreatorLibrary::GetKeyEventReceiver();auto Set=[&](const TCHAR* N,float V){auto* P=FindFProperty<FFloatProperty>(Actor->GetClass(),N);if(P)P->SetPropertyValue_InContainer(Actor,V);};
            auto Input=[&](const TCHAR* Group,int Code,bool Down){FString N=FString(TEXT("GTest_"))+Group;USkinCreatorLibrary::SetPreviewPositionForTests(FVector2D(FloatValue(*(N+TEXT("X"))),FloatValue(*(N+TEXT("Y")))));Receiver->OnKeyEvent.Broadcast(Code,Down,Down?100:0);};
            Input(TEXT("action"),0,true);Input(TEXT("action"),0,false);Step(.02f);Report->SetBoolField(TEXT("serveStartsGame"),FloatValue(TEXT("GPhase"))==1);Report->SetBoolField(TEXT("ballMoves"),FloatValue(TEXT("GBallY"))<437);
            Input(TEXT("left"),1,true);for(int I=0;I<10;I++)Step(.02f);Report->SetBoolField(TEXT("paddleMoves"),FloatValue(TEXT("GPaddle"))<940);Input(TEXT("left"),1,false);float X=FloatValue(TEXT("GPaddle"));Step(.02f);Report->SetBoolField(TEXT("releaseStopsPaddle"),FMath::IsNearlyEqual(X,FloatValue(TEXT("GPaddle"))));
            Set(TEXT("GBallX"),243);Set(TEXT("GBallY"),129);Set(TEXT("GVx"),0);Set(TEXT("GVy"),100);Step(.01f);float Score=FloatValue(TEXT("GScore"));Step(.01f);Report->SetBoolField(TEXT("brickScoresOnce"),Score==25&&FloatValue(TEXT("GScore"))==25&&FloatValue(TEXT("GBrick0"))==0);
            Set(TEXT("GBallX"),FloatValue(TEXT("GPaddle")));Set(TEXT("GBallY"),446);Set(TEXT("GVy"),200);Step(.02f);Report->SetBoolField(TEXT("paddleBounces"),FloatValue(TEXT("GVy"))<0);
            bool Lives=true;for(int I=0;I<3;I++){Set(TEXT("GBallY"),580);Set(TEXT("GPhase"),1);Step(.02f);Lives&=FloatValue(TEXT("GLives"))==2-I;}Report->SetBoolField(TEXT("threeLives"),Lives&&FloatValue(TEXT("GPhase"))==2);
            Input(TEXT("restart"),2,true);Input(TEXT("restart"),2,false);Step(.01f);bool Board=FloatValue(TEXT("GScore"))==0&&FloatValue(TEXT("GLives"))==3&&FloatValue(TEXT("GRemaining"))==30;for(int I=0;I<30;I++)Board&=FloatValue(*FString::Printf(TEXT("GBrick%d"),I))==1;Report->SetBoolField(TEXT("restartResetsBoard"),Board);
            for(int I=1;I<30;I++)Set(*FString::Printf(TEXT("GBrick%d"),I),0);Set(TEXT("GRemaining"),1);Set(TEXT("GBallX"),243);Set(TEXT("GBallY"),129);Set(TEXT("GVx"),0);Set(TEXT("GVy"),100);Step(.01f);Report->SetBoolField(TEXT("lastBrickWins"),FloatValue(TEXT("GPhase"))==3);
        }
        else if(FindFProperty<FFloatProperty>(Actor->GetClass(),TEXT("GPhase")))
        {
            auto* Receiver=USkinCreatorLibrary::GetKeyEventReceiver();
            auto SetFloat=[&](const TCHAR* Name,float Value){auto* P=FindFProperty<FFloatProperty>(Actor->GetClass(),Name);if(P)P->SetPropertyValue_InContainer(Actor,Value);};
            Report->SetBoolField(TEXT("readyBeforePress"),FloatValue(TEXT("GPhase"))==0.f);
            const float StartY=FloatValue(TEXT("GY"));USkinCreatorLibrary::SetPreviewPositionForTests(FVector2D(FloatValue(TEXT("GActionX")),FloatValue(TEXT("GActionY"))));Receiver->OnKeyEvent.Broadcast(0,true,100);
            for(int32 I=0;I<6;I++)Step(.02f);
            Report->SetBoolField(TEXT("pressStartsGame"),FloatValue(TEXT("GPhase"))==1.f);Report->SetBoolField(TEXT("pressMovesPlayer"),FloatValue(TEXT("GY"))<StartY);
            const float Velocity=FloatValue(TEXT("GVy"));Receiver->OnKeyEvent.Broadcast(0,true,100);Report->SetBoolField(TEXT("heldPressIgnored"),FMath::IsNearlyEqual(Velocity,FloatValue(TEXT("GVy"))));Receiver->OnKeyEvent.Broadcast(0,false,0);
            for(int32 I=0;I<400;I++)Step(.02f);Report->SetBoolField(TEXT("collisionEndsRound"),FloatValue(TEXT("GPhase"))==2.f);
            SetFloat(TEXT("GScore"),11.f);USkinCreatorLibrary::SetPreviewPositionForTests(FVector2D(FloatValue(TEXT("GRestartX")),FloatValue(TEXT("GRestartY"))));Receiver->OnKeyEvent.Broadcast(1,true,100);Receiver->OnKeyEvent.Broadcast(1,false,0);Step(.02f);
            Report->SetBoolField(TEXT("restartStartsRound"),FloatValue(TEXT("GPhase"))==1.f);Report->SetBoolField(TEXT("restartClearsScore"),FloatValue(TEXT("GScore"))==0.f);Report->SetBoolField(TEXT("bestScoreRetained"),FloatValue(TEXT("GBest"))>=11.f);
            if(FloatValue(TEXT("GCloud"))>.5f){SetFloat(TEXT("GOX0"),285.f);SetFloat(TEXT("GOY0"),FloatValue(TEXT("GY")));Step(.02f);const float Score=FloatValue(TEXT("GScore"));Step(.02f);Report->SetBoolField(TEXT("passedObstacleScoresOnce"),Score==1.f&&FloatValue(TEXT("GScore"))==Score);}
        }
        else
        {
        auto* Receiver=USkinCreatorLibrary::GetKeyEventReceiver();const FVector2D Center(Before.X+960,Before.Y+275);
        USkinCreatorLibrary::SetPreviewPositionForTests(Center);Receiver->OnKeyEvent.Broadcast(0,true,100);
        const float PressTime=FloatValue(TEXT("FleeTime"));Report->SetNumberField(TEXT("nearFleeDistance"),VectorValue(TEXT("FleeGoal")).Size());Report->SetNumberField(TEXT("pressTime"),PressTime);
        for(int32 I=0;I<6;I++)Step(.05f);Report->SetNumberField(TEXT("displacementAfterPress"),VectorValue(TEXT("CurrentOffset")).Size());
        Receiver->OnKeyEvent.Broadcast(0,true,100);Report->SetBoolField(TEXT("heldPressIgnored"),FMath::IsNearlyEqual(FloatValue(TEXT("FleeTime")),PressTime));
        Receiver->OnKeyEvent.Broadcast(0,false,0);USkinCreatorLibrary::SetPreviewPositionForTests(Center+FVector2D(5000,5000));Receiver->OnKeyEvent.Broadcast(1,true,100);
        Report->SetBoolField(TEXT("farPressIgnored"),FMath::IsNearlyEqual(FloatValue(TEXT("FleeTime")),PressTime));Receiver->OnKeyEvent.Broadcast(1,false,0);
        const FVector Current=Actor->GetActorLocation();USkinCreatorLibrary::SetPreviewPositionForTests(FVector2D(Current.X+960,Current.Y+275));Receiver->OnKeyEvent.Broadcast(0,true,100);
        Report->SetBoolField(TEXT("newPressAccepted"),FloatValue(TEXT("FleeTime"))>PressTime);Report->SetBoolField(TEXT("finiteTransform"),!Actor->GetActorTransform().ContainsNaN());
        Receiver->OnKeyEvent.Broadcast(0,false,0);
        }
        Actor->Destroy();
    }
    else Report->SetStringField(TEXT("error"),TEXT("Test actor could not be created."));
    USkinCreatorLibrary::SetPreviewPositionForTests(FVector2D::ZeroVector);
    USkinCreatorLibrary::SetPreviewReceiverAvailableForTests(true);
    GEngine->DestroyWorldContext(World);World->DestroyWorld(false);FString Json;FJsonSerializer::Serialize(Report,TJsonWriterFactory<>::Create(&Json));return Json;
}
bool USkinStudioDeviceBuilder::ValidateDeviceMaterials(const TArray<UMaterialInterface*>& Materials)
{
    // Unreal can report shader failure as a warning and exit successfully.
    // Reject a failed generated shader before describing the package as ready.
    if(GShaderCompilingManager)GShaderCompilingManager->FinishAllCompilation();
    bool Good=true;
    for(auto* Material:Materials)
    {
        if(!Material||!Material->GetPathName().StartsWith(TEXT("/Game/Companion/Materials/")))return false;
        for(auto Feature:{ERHIFeatureLevel::ES3_1,ERHIFeatureLevel::SM5})
        {
            const auto* Resource=Material->GetMaterialResource(Feature);
            if(Resource)for(const FString& Error:Resource->GetCompileErrors())
            {UE_LOG(LogTemp,Error,TEXT("Generated native material %s failed shader compilation: %s"),*Material->GetName(),*Error);Good=false;}
        }
    }
    return Good;
}
bool USkinStudioDeviceBuilder::CaptureRuntimePreview(float Seconds,bool PressKey,float KeyX,float KeyY,int32 PressCount)
{
    UWorld* Source=GEditor?GEditor->GetEditorWorldContext().World():nullptr;
    if(!GEngine||!Source||Source->GetOutermost()->GetName()!=TEXT("/Game/map/M_EntryPoint")||!FMath::IsFinite(Seconds)||Seconds<0||Seconds>10)return false;
    if(GShaderCompilingManager)GShaderCompilingManager->FinishAllCompilation();
    UWorld* World=UWorld::CreateWorld(EWorldType::Game,false,FName(TEXT("StudioRenderTest")));if(!World)return false;
    GEngine->CreateNewWorldContext(EWorldType::Game).SetCurrentWorld(World);
    FActorSpawnParameters Params;Params.SpawnCollisionHandlingOverride=ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    TArray<AActor*> Actors;
    for(TActorIterator<AActor> It(Source);It;++It)if(It->GetClass()->GetPathName().StartsWith(TEXT("/Game/Companion/BP_"))){if(auto* Actor=World->SpawnActor<AActor>(It->GetClass(),It->GetActorLocation(),It->GetActorRotation(),Params))Actors.Add(Actor);}
    World->InitializeActorsForPlay(FURL());for(auto* Actor:Actors)Actor->DispatchBeginPlay();
    auto Step=[&](){++GFrameCounter;World->Tick(LEVELTICK_All,1.f/60);World->SendAllEndOfFrameUpdates();FlushRenderingCommands();};
    USkinCreatorLibrary::SetPreviewReceiverAvailableForTests(true);Step();Step();
    auto* Receiver=USkinCreatorLibrary::GetKeyEventReceiver();for(int32 I=0;I<FMath::Clamp(PressCount,1,4);I++){if(PressKey&&Receiver){USkinCreatorLibrary::SetPreviewPositionForTests(FVector2D(FMath::Clamp(KeyX+I*400,0.f,1920.f),FMath::Clamp(KeyY,0.f,550.f)));Receiver->OnKeyEvent.Broadcast(I,true,100);Receiver->OnKeyEvent.Broadcast(I,false,0);}Step();Step();Step();}
    for(int32 I=0;I<FMath::CeilToInt(Seconds*60);I++)Step();
    auto* Target=NewObject<UTextureRenderTarget2D>(GetTransientPackage());Target->InitCustomFormat(1920,550,PF_B8G8R8A8,false);Target->UpdateResourceImmediate(true);
    auto* Camera=World->SpawnActor<ASceneCapture2D>(FVector(0,0,1500),FRotator(-90,-90,0));bool Good=false;
    if(Camera){auto* Capture=Camera->GetCaptureComponent2D();Capture->ProjectionType=ECameraProjectionMode::Orthographic;Capture->OrthoWidth=1920;Capture->TextureTarget=Target;Capture->CaptureSource=SCS_FinalColorLDR;Capture->bCaptureEveryFrame=false;Capture->bCaptureOnMovement=false;Capture->ShowFlags.SetPostProcessing(false);Capture->CaptureScene();FlushRenderingCommands();FReadSurfaceDataFlags Flags(RCM_UNorm);Flags.SetLinearToGamma(false);TArray<FColor> Pixels;Good=Target->GameThread_GetRenderTargetResource()->ReadPixels(Pixels,Flags)&&Pixels.Num()==1920*550;if(Good){TArray<uint8> Png;FImageUtils::CompressImageArray(1920,550,Pixels,Png);Good=FFileHelper::SaveArrayToFile(Png,*(FPaths::ProjectSavedDir()/TEXT("StudioRuntimePreview.png")));}}
    USkinCreatorLibrary::SetPreviewPositionForTests(FVector2D::ZeroVector);GEngine->DestroyWorldContext(World);World->DestroyWorld(false);FlushRenderingCommands();return Good;
}
bool USkinStudioDeviceBuilder::CaptureDevicePreview()
{
    UWorld* World=GEditor?GEditor->GetEditorWorldContext().World():nullptr;
    if(!World||World->GetOutermost()->GetName()!=TEXT("/Game/map/M_EntryPoint"))return false;
    if(GShaderCompilingManager)GShaderCompilingManager->FinishAllCompilation();
    for(TActorIterator<AActor> It(World);It;++It)
    {
        TInlineComponentArray<UPrimitiveComponent*> Components(*It);
        for(auto* Component:Components)Component->ReregisterComponent();
    }
    World->SendAllEndOfFrameUpdates();FlushRenderingCommands();
    auto* Target=NewObject<UTextureRenderTarget2D>(GetTransientPackage());Target->InitCustomFormat(1920,550,PF_B8G8R8A8,false);Target->UpdateResourceImmediate(true);
    auto* Camera=World->SpawnActor<ASceneCapture2D>(FVector(0,0,1500),FRotator(-90,-90,0));if(!Camera)return false;
    auto* Capture=Camera->GetCaptureComponent2D();Capture->ProjectionType=ECameraProjectionMode::Orthographic;Capture->OrthoWidth=1920;Capture->TextureTarget=Target;Capture->CaptureSource=SCS_FinalColorLDR;Capture->bCaptureEveryFrame=false;Capture->bCaptureOnMovement=false;Capture->ShowFlags.SetPostProcessing(false);Capture->CaptureScene();FlushRenderingCommands();
    FReadSurfaceDataFlags ReadFlags(RCM_UNorm);ReadFlags.SetLinearToGamma(false);
    TArray<FColor> Pixels;bool Good=Target->GameThread_GetRenderTargetResource()->ReadPixels(Pixels,ReadFlags);Camera->Destroy();
    if(!Good||Pixels.Num()!=1920*550)return false;TArray<uint8> Png;FImageUtils::CompressImageArray(1920,550,Pixels,Png);return FFileHelper::SaveArrayToFile(Png,*(FPaths::ProjectSavedDir()/TEXT("StudioDevicePreview.png")));
}
  UBlueprint* USkinStudioDeviceBuilder::CreateInputBlueprint(UMaterialParameterCollection* Collection, bool Diagnostics)
{
    // Deliberately fixed output. Never mutate an existing user-authored Blueprint.
    if(!Collection||FindObject<UObject>(nullptr,TEXT("/Game/Companion/BP_KeyboardInput.BP_KeyboardInput"))||LoadObject<UObject>(nullptr,TEXT("/Game/Companion/BP_KeyboardInput.BP_KeyboardInput")))return nullptr;
    UPackage* Package=CreatePackage(TEXT("/Game/Companion/BP_KeyboardInput"));
    UBlueprint* Blueprint=FKismetEditorUtilities::CreateBlueprint(AActor::StaticClass(),Package,TEXT("BP_KeyboardInput"),BPTYPE_Normal,UBlueprint::StaticClass(),UBlueprintGeneratedClass::StaticClass());
    if(!Blueprint||Blueprint->UbergraphPages.Num()!=1)return nullptr;
    if(Diagnostics)
    {
        USCS_Node* RootNode=Blueprint->SimpleConstructionScript->CreateNode(USceneComponent::StaticClass(),TEXT("SceneRoot"));
        USCS_Node* TextNode=Blueprint->SimpleConstructionScript->CreateNode(UTextRenderComponent::StaticClass(),TEXT("DiagnosticText"));
        UTextRenderComponent* Text=Cast<UTextRenderComponent>(TextNode->ComponentTemplate);
        auto* Font=LoadObject<UFont>(nullptr,TEXT("/Game/Companion/Fonts/StudioFont.StudioFont"));
        auto* TextMaterial=LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/Companion/Materials/M_DiagnosticText.M_DiagnosticText"));
        if(!Font||!TextMaterial)return nullptr;
        Text->SetFont(Font);Text->SetTextMaterial(TextMaterial);
        Text->SetText(FText::FromString(TEXT("TEST READY | WAITING FOR INPUT")));
        Text->SetWorldSize(58);Text->SetHorizontalAlignment(EHTA_Left);Text->SetVerticalAlignment(EVRTA_TextCenter);
        Text->SetTextRenderColor(FColor::White);Text->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Text->SetRelativeLocation(FVector(-870,0,500));
        Text->SetRelativeRotation(FRotationMatrix::MakeFromXY(FVector(0,0,1),FVector(-1,0,0)).Rotator());
        RootNode->AddChildNode(TextNode);Blueprint->SimpleConstructionScript->AddNode(RootNode);
        // Expose the new SCS component in the skeleton before allocating its
        // variable-get pins below; otherwise the diagnostic target is untyped.
        FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);
    }
    FEdGraphPinType BoundType;BoundType.PinCategory=UEdGraphSchema_K2::PC_Boolean;
    if(!FBlueprintEditorUtils::AddMemberVariable(Blueprint,TEXT("InputBound"),BoundType,TEXT("False")))return nullptr;
    UEdGraph* Graph=Blueprint->UbergraphPages[0];bool Good=true;
    auto* Begin=Node<UK2Node_Event>(Graph,0,0);Begin->EventReference.SetExternalMember(TEXT("ReceiveTick"),AActor::StaticClass());Begin->bOverrideFunction=true;Begin->AllocateDefaultPins();
    auto* Bound=Node<UK2Node_VariableGet>(Graph,-500,0);Bound->VariableReference.SetSelfMember(TEXT("InputBound"));Bound->AllocateDefaultPins();
    auto* NotBound=Call(Graph,UKismetMathLibrary::StaticClass(),TEXT("Not_PreBool"),-260,0);
    auto* NeedBind=Node<UK2Node_IfThenElse>(Graph,270,0);NeedBind->AllocateDefaultPins();
    auto* Receiver=Call(Graph,USkinCreatorLibrary::StaticClass(),TEXT("GetKeyEventReceiver"),0,170);
    auto* Valid=Call(Graph,UKismetSystemLibrary::StaticClass(),TEXT("IsValid"),270,170);
    auto* Ready=Node<UK2Node_IfThenElse>(Graph,600,0);Ready->AllocateDefaultPins();
    auto* Bind=Node<UK2Node_AddDelegate>(Graph,330,0);
    auto* Property=FindFProperty<FMulticastDelegateProperty>(UKeyEventReceiver::StaticClass(),TEXT("OnKeyEvent"));if(!Property)return nullptr;
    Bind->SetFromProperty(Property,false,UKeyEventReceiver::StaticClass());Bind->AllocateDefaultPins();
    auto* Key=Node<UK2Node_CustomEvent>(Graph,0,430);Key->CustomFunctionName=TEXT("StudioKeyboardInput");Key->AllocateDefaultPins();
    FEdGraphPinType Byte;Byte.PinCategory=UEdGraphSchema_K2::PC_Byte;Key->CreateUserDefinedPin(TEXT("HCode"),Byte,EGPD_Output);
    FEdGraphPinType Bool;Bool.PinCategory=UEdGraphSchema_K2::PC_Boolean;Key->CreateUserDefinedPin(TEXT("IsActuated"),Bool,EGPD_Output);
    FEdGraphPinType Int;Int.PinCategory=UEdGraphSchema_K2::PC_Int;Key->CreateUserDefinedPin(TEXT("Percentage"),Int,EGPD_Output);
    Good&=Wire(Graph,Bound,TEXT("InputBound"),NotBound,TEXT("A"));Good&=Wire(Graph,NotBound,TEXT("ReturnValue"),NeedBind,TEXT("Condition"));Good&=Wire(Graph,Begin,TEXT("then"),NeedBind,TEXT("execute"));
    Good&=Wire(Graph,Receiver,TEXT("ReturnValue"),Valid,TEXT("Object"));Good&=Wire(Graph,Valid,TEXT("ReturnValue"),Ready,TEXT("Condition"));Good&=Wire(Graph,NeedBind,TEXT("then"),Ready,TEXT("execute"));
    Good&=Wire(Graph,Ready,TEXT("then"),Bind,TEXT("execute"));Good&=Wire(Graph,Receiver,TEXT("ReturnValue"),Bind,TEXT("self"));
    Good&=Wire(Graph,Key,TEXT("OutputDelegate"),Bind,TEXT("Delegate"));
    auto* SaveBound=Node<UK2Node_VariableSet>(Graph,900,0);SaveBound->VariableReference.SetSelfMember(TEXT("InputBound"));SaveBound->AllocateDefaultPins();SaveBound->FindPin(TEXT("InputBound"))->DefaultValue=TEXT("true");Good&=Wire(Graph,Bind,TEXT("then"),SaveBound,TEXT("execute"));
    if(Diagnostics){auto* StatusGet=Node<UK2Node_VariableGet>(Graph,1200,170);StatusGet->VariableReference.SetSelfMember(TEXT("DiagnosticText"));StatusGet->AllocateDefaultPins();auto* StatusText=Call(Graph,UKismetTextLibrary::StaticClass(),TEXT("Conv_StringToText"),1200,320);StatusText->FindPin(TEXT("InString"))->DefaultValue=TEXT("TEST READY | INPUT CONNECTED");auto* SetStatus=Call(Graph,UTextRenderComponent::StaticClass(),TEXT("K2_SetText"),1500,0);Good&=Wire(Graph,StatusGet,TEXT("DiagnosticText"),SetStatus,TEXT("self"));Good&=Wire(Graph,StatusText,TEXT("ReturnValue"),SetStatus,TEXT("Value"));Good&=Wire(Graph,SaveBound,TEXT("then"),SetStatus,TEXT("execute"));}
    auto* Branch=Node<UK2Node_IfThenElse>(Graph,330,430);Branch->AllocateDefaultPins();
    Good&=Wire(Graph,Key,TEXT("then"),Branch,TEXT("execute"));Good&=Wire(Graph,Key,TEXT("IsActuated"),Branch,TEXT("Condition"));
    auto* Time=Call(Graph,UGameplayStatics::StaticClass(),TEXT("GetTimeSeconds"),330,650);
    auto* Last=Call(Graph,UKismetMaterialLibrary::StaticClass(),TEXT("SetScalarParameterValue"),620,430);Parameter(Last,Collection,TEXT("LastPress"));
    Good&=Wire(Graph,Branch,TEXT("then"),Last,TEXT("execute"));Good&=Wire(Graph,Time,TEXT("ReturnValue"),Last,TEXT("ParameterValue"));
    auto* Strength=Call(Graph,UKismetMaterialLibrary::StaticClass(),TEXT("SetScalarParameterValue"),940,430);Parameter(Strength,Collection,TEXT("Pressure"));
    auto* AsFloat=Call(Graph,UKismetMathLibrary::StaticClass(),TEXT("Conv_IntToFloat"),340,810);
    auto* Normalized=Call(Graph,UKismetMathLibrary::StaticClass(),TEXT("Divide_FloatFloat"),610,800);Normalized->FindPin(TEXT("B"))->DefaultValue=TEXT("100.0");
    Good&=Wire(Graph,Key,TEXT("Percentage"),AsFloat,TEXT("InInt"));Good&=Wire(Graph,AsFloat,TEXT("ReturnValue"),Normalized,TEXT("A"));
    Good&=Wire(Graph,Normalized,TEXT("ReturnValue"),Strength,TEXT("ParameterValue"));Good&=Wire(Graph,Last,TEXT("then"),Strength,TEXT("execute"));
    auto* Position=Call(Graph,USkinCreatorLibrary::StaticClass(),TEXT("GetPositionByKeyIndex"),0,1100);
    Good&=Wire(Graph,Key,TEXT("HCode"),Position,TEXT("KeyIndex"));
    auto* Split=Call(Graph,UKismetMathLibrary::StaticClass(),TEXT("BreakVector2D"),270,1100);
    Good&=Wire(Graph,Position,TEXT("ReturnValue"),Split,TEXT("InVec"));
    auto* PX=Call(Graph,UKismetMaterialLibrary::StaticClass(),TEXT("SetScalarParameterValue"),1220,430);Parameter(PX,Collection,TEXT("PressX"));
    auto* PY=Call(Graph,UKismetMaterialLibrary::StaticClass(),TEXT("SetScalarParameterValue"),1500,430);Parameter(PY,Collection,TEXT("PressY"));
    Good&=Wire(Graph,Strength,TEXT("then"),PX,TEXT("execute"));Good&=Wire(Graph,PX,TEXT("then"),PY,TEXT("execute"));
    Good&=Wire(Graph,Split,TEXT("X"),PX,TEXT("ParameterValue"));Good&=Wire(Graph,Split,TEXT("Y"),PY,TEXT("ParameterValue"));
    if(Diagnostics)
    {
        auto* CodeString=Call(Graph,UKismetStringLibrary::StaticClass(),TEXT("Conv_ByteToString"),20,1320);
        auto* PositionString=Call(Graph,UKismetStringLibrary::StaticClass(),TEXT("Conv_Vector2dToString"),270,1320);
        auto* Prefix=Call(Graph,UKismetStringLibrary::StaticClass(),TEXT("Concat_StrStr"),540,1260);Prefix->FindPin(TEXT("A"))->DefaultValue=TEXT("HCode: ");
        auto* Separator=Call(Graph,UKismetStringLibrary::StaticClass(),TEXT("Concat_StrStr"),800,1260);Separator->FindPin(TEXT("B"))->DefaultValue=TEXT("  |  Host position: ");
        auto* Complete=Call(Graph,UKismetStringLibrary::StaticClass(),TEXT("Concat_StrStr"),1070,1260);
        auto* TextValue=Call(Graph,UKismetTextLibrary::StaticClass(),TEXT("Conv_StringToText"),1340,1260);
        auto* TextGet=Node<UK2Node_VariableGet>(Graph,1340,1480);TextGet->VariableReference.SetSelfMember(TEXT("DiagnosticText"));TextGet->AllocateDefaultPins();
        auto* SetText=Call(Graph,UTextRenderComponent::StaticClass(),TEXT("K2_SetText"),1790,430);
        Good&=Wire(Graph,Key,TEXT("HCode"),CodeString,TEXT("InByte"));Good&=Wire(Graph,Position,TEXT("ReturnValue"),PositionString,TEXT("InVec"));
        Good&=Wire(Graph,CodeString,TEXT("ReturnValue"),Prefix,TEXT("B"));Good&=Wire(Graph,Prefix,TEXT("ReturnValue"),Separator,TEXT("A"));
        Good&=Wire(Graph,Separator,TEXT("ReturnValue"),Complete,TEXT("A"));Good&=Wire(Graph,PositionString,TEXT("ReturnValue"),Complete,TEXT("B"));
        Good&=Wire(Graph,Complete,TEXT("ReturnValue"),TextValue,TEXT("InString"));Good&=Wire(Graph,TextValue,TEXT("ReturnValue"),SetText,TEXT("Value"));
        Good&=Wire(Graph,TextGet,TEXT("DiagnosticText"),SetText,TEXT("self"));Good&=Wire(Graph,PY,TEXT("then"),SetText,TEXT("execute"));
    }
    if(!Good){UE_LOG(LogTemp,Error,TEXT("Device input Blueprint pins did not match Unreal 4.27. No ready package produced."));return nullptr;}
    FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(Blueprint);FKismetEditorUtilities::CompileBlueprint(Blueprint);
    if(Blueprint->Status==BS_Error)return nullptr;
    if(auto* CDO=Cast<AActor>(Blueprint->GeneratedClass->GetDefaultObject())){CDO->PrimaryActorTick.bCanEverTick=true;CDO->PrimaryActorTick.bStartWithTickEnabled=true;}
    FAssetRegistryModule::AssetCreated(Blueprint);Package->MarkPackageDirty();return Blueprint;
}
