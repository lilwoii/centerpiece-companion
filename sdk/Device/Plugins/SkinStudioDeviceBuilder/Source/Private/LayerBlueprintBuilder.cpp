// Editor-only graph generation. Generated assets reference Engine and SkinApi,
// never this builder module. All per-frame and key-event work is Blueprint VM code.
#include "SkinStudioDeviceBuilder.h"
#include "SkinCreatorLibrary.h"
#include "KeyEventReceiver.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialParameterCollection.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Components/SceneComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/Font.h"
#include "Engine/SimpleConstructionScript.h"
#include "Engine/SCS_Node.h"
#include "Engine/Blueprint.h"
#include "Engine/BlueprintGeneratedClass.h"
#include "GameFramework/Actor.h"
#include "Kismet/GameplayStatics.h"
#include "Kismet/KismetMathLibrary.h"
#include "Kismet/KismetMaterialLibrary.h"
#include "Kismet/KismetRenderingLibrary.h"
#include "Kismet/KismetStringLibrary.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/TextureRenderTarget2D.h"
#include "Kismet/KismetArrayLibrary.h"
#include "Kismet/KismetSystemLibrary.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "EdGraphSchema_K2.h"
#include "K2Node_Event.h"
#include "K2Node_CustomEvent.h"
#include "K2Node_CallFunction.h"
#include "K2Node_CallArrayFunction.h"
#include "K2Node_GetArrayItem.h"
#include "K2Node_AddDelegate.h"
#include "K2Node_IfThenElse.h"
#include "K2Node_ExecutionSequence.h"
#include "K2Node_VariableGet.h"
#include "K2Node_VariableSet.h"
#include "AssetRegistryModule.h"
#include "UObject/UnrealType.h"

namespace StudioLayerBuilder
{
struct V
{
 UEdGraphPin* Pin=nullptr; FString Literal;
 V(){} V(UEdGraphPin* P):Pin(P){} V(float N):Literal(FString::SanitizeFloat(N)){} V(const FString& S):Literal(S){}
};
struct Graph
{
 UBlueprint* BP; UEdGraph* G; bool Good=true; int32 Count=0;
 Graph(UBlueprint* In):BP(In),G(In->UbergraphPages[0]){}
 template<class T>T* Node(){auto* N=NewObject<T>(G);G->AddNode(N,false,false);N->CreateNewGuid();N->NodePosX=(Count%12)*270;N->NodePosY=(Count/12)*270;Count++;return N;}
 UEdGraphPin* Pin(UEdGraphNode* N,const TCHAR* Name){auto* P=N?N->FindPin(Name):nullptr;if(!P){Good=false;UE_LOG(LogTemp,Error,TEXT("Native layer graph is missing pin %s"),Name);}return P;}
 void Connect(UEdGraphPin* A,UEdGraphPin* B){if(!A||!B||!GetDefault<UEdGraphSchema_K2>()->TryCreateConnection(A,B)){Good=false;UE_LOG(LogTemp,Error,TEXT("Native layer graph connection failed: %s -> %s"),A?*A->PinName.ToString():TEXT("null"),B?*B->PinName.ToString():TEXT("null"));}}
 void Input(UEdGraphNode* N,const TCHAR* Name,V Value){auto* P=Pin(N,Name);if(!P)return;if(Value.Pin)Connect(Value.Pin,P);else GetDefault<UEdGraphSchema_K2>()->TrySetDefaultValue(*P,Value.Literal);}
 UK2Node_CallFunction* Call(UClass* Class,const TCHAR* Name){UFunction* F=Class->FindFunctionByName(Name);if(!F){Good=false;UE_LOG(LogTemp,Error,TEXT("Native layer function unavailable: %s"),Name);return nullptr;}auto* N=Node<UK2Node_CallFunction>();N->SetFromFunction(F);N->AllocateDefaultPins();return N;}
 V Math(const TCHAR* Name,V A,V B){auto* N=Call(UKismetMathLibrary::StaticClass(),Name);Input(N,TEXT("A"),A);Input(N,TEXT("B"),B);return Pin(N,TEXT("ReturnValue"));}
 V Unary(const TCHAR* Name,V A,const TCHAR* In=TEXT("A")){auto* N=Call(UKismetMathLibrary::StaticClass(),Name);Input(N,In,A);return Pin(N,TEXT("ReturnValue"));}
 V Clamp(V A,float Low=0,float High=1){auto* N=Call(UKismetMathLibrary::StaticClass(),TEXT("FClamp"));Input(N,TEXT("Value"),A);Input(N,TEXT("Min"),Low);Input(N,TEXT("Max"),High);return Pin(N,TEXT("ReturnValue"));}
 V Vector(V X,V Y,V Z=0.f){auto* N=Call(UKismetMathLibrary::StaticClass(),TEXT("MakeVector"));Input(N,TEXT("X"),X);Input(N,TEXT("Y"),Y);Input(N,TEXT("Z"),Z);return Pin(N,TEXT("ReturnValue"));}
 V Rotator(V Yaw){auto* N=Call(UKismetMathLibrary::StaticClass(),TEXT("MakeRotator"));Input(N,TEXT("Yaw"),Yaw);return Pin(N,TEXT("ReturnValue"));}
 V Time(){return Pin(Call(UGameplayStatics::StaticClass(),TEXT("GetTimeSeconds")),TEXT("ReturnValue"));}
 void Variable(const TCHAR* Name,const FEdGraphPinType& Type,const FString& Default){Good&=FBlueprintEditorUtils::AddMemberVariable(BP,FName(Name),Type,Default);}
 V Get(const TCHAR* Name){auto* N=Node<UK2Node_VariableGet>();N->VariableReference.SetSelfMember(Name);N->AllocateDefaultPins();return Pin(N,Name);}
 UEdGraphPin* Set(const TCHAR* Name,V Value,UEdGraphPin* Exec){auto* N=Node<UK2Node_VariableSet>();N->VariableReference.SetSelfMember(Name);N->AllocateDefaultPins();Input(N,Name,Value);Connect(Exec,Pin(N,TEXT("execute")));return Pin(N,TEXT("then"));}
 UEdGraphPin* Parameter(UMaterialParameterCollection* Collection,const FString& Name,V Value,UEdGraphPin* Exec){auto* N=Call(UKismetMaterialLibrary::StaticClass(),TEXT("SetScalarParameterValue"));if(auto* P=Pin(N,TEXT("Collection")))P->DefaultObject=Collection;Input(N,TEXT("ParameterName"),Name);Input(N,TEXT("ParameterValue"),Value);Connect(Exec,Pin(N,TEXT("execute")));return Pin(N,TEXT("then"));}
 UEdGraphPin* NamedParameter(UMaterialParameterCollection* Collection,V Name,V Value,UEdGraphPin* Exec){auto* N=Call(UKismetMaterialLibrary::StaticClass(),TEXT("SetScalarParameterValue"));Pin(N,TEXT("Collection"))->DefaultObject=Collection;Input(N,TEXT("ParameterName"),Name);Input(N,TEXT("ParameterValue"),Value);Connect(Exec,Pin(N,TEXT("execute")));return Pin(N,TEXT("then"));}
 V ReadParameter(UMaterialParameterCollection* Collection,const FString& Name,UEdGraphPin*& Exec){auto* N=Call(UKismetMaterialLibrary::StaticClass(),TEXT("GetScalarParameterValue"));if(auto* P=Pin(N,TEXT("Collection")))P->DefaultObject=Collection;Input(N,TEXT("ParameterName"),Name);Connect(Exec,Pin(N,TEXT("execute")));Exec=Pin(N,TEXT("then"));return Pin(N,TEXT("ReturnValue"));}
 UK2Node_Event* Event(const TCHAR* Name){auto* N=Node<UK2Node_Event>();N->EventReference.SetExternalMember(Name,AActor::StaticClass());N->bOverrideFunction=true;N->AllocateDefaultPins();return N;}
 UK2Node_IfThenElse* Branch(V Condition,UEdGraphPin* Exec){auto* N=Node<UK2Node_IfThenElse>();N->AllocateDefaultPins();Input(N,TEXT("Condition"),Condition);Connect(Exec,Pin(N,TEXT("execute")));return N;}
};
float Num(const TSharedPtr<FJsonObject>& J,const TCHAR* Field,float Default){double Out;return J.IsValid()&&J->TryGetNumberField(Field,Out)&&FMath::IsFinite(Out)?float(Out):Default;}
FString Str(const TSharedPtr<FJsonObject>& J,const TCHAR* Field,const TCHAR* Default=TEXT("")){FString Out;return J.IsValid()&&J->TryGetStringField(Field,Out)?Out:FString(Default);}
bool Flag(const TSharedPtr<FJsonObject>& J,const TCHAR* Field,bool Default){bool Out;return J.IsValid()&&J->TryGetBoolField(Field,Out)?Out:Default;}
float Rand(uint32 Seed,uint32 Index){uint32 X=Seed^((Index+1)*374761393u);X=(X^(X>>13))*1274126177u;return float(double(X^(X>>16))/4294967296.0);}
V Add(Graph& B,V A,V C){return B.Math(TEXT("Add_FloatFloat"),A,C);} V Sub(Graph& B,V A,V C){return B.Math(TEXT("Subtract_FloatFloat"),A,C);} V Mul(Graph& B,V A,V C){return B.Math(TEXT("Multiply_FloatFloat"),A,C);} V Div(Graph& B,V A,V C){return B.Math(TEXT("Divide_FloatFloat"),A,C);}
V Smooth(Graph& B,V A){V T=B.Clamp(A);return Mul(B,Mul(B,T,T),Sub(B,3.f,Mul(B,2.f,T)));}
V Timeline(Graph& B,const TSharedPtr<FJsonObject>& Layer,const TCHAR* Property,V Clock,float Default)
{
 V Value(Num(Layer,Property,Default));const TArray<TSharedPtr<FJsonValue>>* Frames=nullptr;
 if(!Layer->TryGetArrayField(TEXT("keyframes"),Frames))return Value;
 float PreviousTime=0,PreviousValue=Num(Layer,Property,Default);
 for(const auto& Item:*Frames){auto F=Item->AsObject();if(Str(F,TEXT("property"))!=Property)continue;
  float NextTime=Num(F,TEXT("time"),0),NextValue=Num(F,TEXT("value"),PreviousValue);V Phase=NextTime>PreviousTime?B.Clamp(Div(B,Sub(B,Clock,PreviousTime),NextTime-PreviousTime)):V(1.f);
  FString Easing=Str(F,TEXT("easing"),TEXT("linear"));V Factor=Phase;if(Easing==TEXT("ease-in"))Factor=Mul(B,Phase,Phase);else if(Easing==TEXT("ease-out"))Factor=Sub(B,1.f,Mul(B,Sub(B,1.f,Phase),Sub(B,1.f,Phase)));else if(Easing==TEXT("smooth"))Factor=Smooth(B,Phase);
  Value=Add(B,Value,Mul(B,NextValue-PreviousValue,Factor));PreviousTime=NextTime;PreviousValue=NextValue;
 }return Value;
}

}

#include "GameBlueprintLogic.inl"
#include "PrismBlueprintLogic.inl"
#include "HeatmapBlueprintLogic.inl"

UBlueprint* USkinStudioDeviceBuilder::CreateLayerBlueprint(UMaterialParameterCollection* Collection,UMaterialInterface* Material,const FString& LayerJson,const FString& RulesJson,const FString& AssetName)
{
 using namespace StudioLayerBuilder;
 TSharedPtr<FJsonObject> Layer;TArray<TSharedPtr<FJsonValue>> Rules;
 if(!Collection||LayerJson.Len()>1024*1024||RulesJson.Len()>1024*1024||!AssetName.StartsWith(TEXT("BP_Layer_"))||AssetName.Len()>64)return nullptr;
 for(TCHAR C:AssetName)if(!FChar::IsAlnum(C)&&C!='_')return nullptr;
 if(!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(LayerJson),Layer)||!Layer.IsValid()||!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(RulesJson),Rules)||Rules.Num()>32)return nullptr;
 const FString Path=TEXT("/Game/Companion/")+AssetName;
 if(LoadObject<UObject>(nullptr,*(Path+TEXT(".")+AssetName)))return nullptr;
 UPackage* Package=CreatePackage(*Path);UBlueprint* BP=FKismetEditorUtilities::CreateBlueprint(AActor::StaticClass(),Package,FName(*AssetName),BPTYPE_Normal,UBlueprint::StaticClass(),UBlueprintGeneratedClass::StaticClass());
 if(!BP||BP->UbergraphPages.Num()!=1)return nullptr;
 const float Width=Num(Layer,TEXT("width"),1920),Height=Num(Layer,TEXT("height"),550),X=Num(Layer,TEXT("x"),0)+Width/2-960,Y=Num(Layer,TEXT("y"),0)+Height/2-275,Depth=Num(Layer,TEXT("nativeDepth"),0),Rotation=Num(Layer,TEXT("rotation"),0);
 const bool Text=Str(Layer,TEXT("type"))==TEXT("text")&&!Flag(Layer,TEXT("nativeTextRaster"),false);
 // Keep geometry scale/orientation below an identity root. Actor pulse/motion
 // must not replace the plane's width/height or a text component's facing axis.
 USCS_Node* SceneRoot=BP->SimpleConstructionScript->CreateNode(USceneComponent::StaticClass(),TEXT("SceneRoot"));
 Cast<USceneComponent>(SceneRoot->ComponentTemplate)->SetMobility(EComponentMobility::Movable);
 USCS_Node* RootNode=BP->SimpleConstructionScript->CreateNode(Text?UTextRenderComponent::StaticClass():UStaticMeshComponent::StaticClass(),TEXT("SkinObject"));
 if(Text){auto* C=Cast<UTextRenderComponent>(RootNode->ComponentTemplate);C->SetText(FText::FromString(Str(Layer,TEXT("text"))));C->SetWorldSize(Num(Layer,TEXT("fontSize"),72));C->SetTextRenderColor(FColor::FromHex(Str(Layer,TEXT("color"),TEXT("#ffffff"))));C->SetHorizontalAlignment(Str(Layer,TEXT("textAlign"))==TEXT("left")?EHTA_Left:Str(Layer,TEXT("textAlign"))==TEXT("right")?EHTA_Right:EHTA_Center);C->SetVerticalAlignment(Str(Layer,TEXT("textVertical"))==TEXT("top")?EVRTA_TextTop:Str(Layer,TEXT("textVertical"))==TEXT("bottom")?EVRTA_TextBottom:EVRTA_TextCenter);C->SetRelativeRotation(FRotationMatrix::MakeFromXY(FVector(0,0,1),FVector(-1,0,0)).Rotator());C->SetCollisionEnabled(ECollisionEnabled::NoCollision);}
 else{if(!Material)return nullptr;auto* C=Cast<UStaticMeshComponent>(RootNode->ComponentTemplate);const FString MeshPath=Str(Layer,TEXT("nativeParticleMesh"),TEXT("/Game/Companion/Meshes/Plane.Plane"));if(!MeshPath.StartsWith(TEXT("/Game/Companion/Meshes/")))return nullptr;auto* Mesh=LoadObject<UStaticMesh>(nullptr,*MeshPath);if(!Mesh)return nullptr;C->SetStaticMesh(Mesh);C->SetMaterial(0,Material);C->SetRelativeScale3D(FVector(Width/100,Height/100,1));C->SetCollisionEnabled(ECollisionEnabled::NoCollision);C->SetCastShadow(false);C->SetMobility(EComponentMobility::Movable);}
 if(Text){auto* C=Cast<UTextRenderComponent>(RootNode->ComponentTemplate);auto* Font=LoadObject<UFont>(nullptr,TEXT("/Game/Companion/Fonts/StudioFont.StudioFont"));if(!Font||!Material)return nullptr;C->SetFont(Font);C->SetTextMaterial(Material);C->SetMobility(EComponentMobility::Movable);C->SetRelativeLocation(FVector(Str(Layer,TEXT("textAlign"))==TEXT("left")?-Width/2:Str(Layer,TEXT("textAlign"))==TEXT("right")?Width/2:0,Str(Layer,TEXT("textVertical"))==TEXT("top")?-Height/2:Str(Layer,TEXT("textVertical"))==TEXT("bottom")?Height/2:0,0));}
 // Canvas layers require explicit order: distance-based translucency sorting
 // can otherwise draw a large background over an off-center fish or image.
 Cast<UPrimitiveComponent>(RootNode->ComponentTemplate)->SetTranslucentSortPriority(int32(Depth));
 if(Flag(Layer,TEXT("nativeComposite"),false))Cast<UPrimitiveComponent>(RootNode->ComponentTemplate)->SetVisibility(false);
 SceneRoot->AddChildNode(RootNode);BP->SimpleConstructionScript->AddNode(SceneRoot);
 Graph B(BP);FEdGraphPinType Float;Float.PinCategory=UEdGraphSchema_K2::PC_Float;FEdGraphPinType Bool;Bool.PinCategory=UEdGraphSchema_K2::PC_Boolean;FEdGraphPinType Vector;Vector.PinCategory=UEdGraphSchema_K2::PC_Struct;Vector.PinSubCategoryObject=TBaseStructure<FVector>::Get();
 B.Variable(TEXT("CurrentOffset"),Vector,TEXT("(X=0,Y=0,Z=0)"));B.Variable(TEXT("FleeGoal"),Vector,TEXT("(X=0,Y=0,Z=0)"));B.Variable(TEXT("FleeTime"),Float,TEXT("-1000"));B.Variable(TEXT("FleeDuration"),Float,TEXT("1"));B.Variable(TEXT("SkinVisible"),Bool,Flag(Layer,TEXT("visible"),true)?TEXT("True"):TEXT("False"));
 B.Variable(TEXT("FleeYaw"),Float,FString::SanitizeFloat(Rotation));B.Variable(TEXT("InputBound"),Bool,TEXT("False"));
 FEdGraphPinType CursorType;CursorType.PinCategory=UEdGraphSchema_K2::PC_Int;for(int32 I=0;I<Rules.Num();I++)B.Variable(*FString::Printf(TEXT("EventCursor%d"),I),CursorType,TEXT("0"));
 FEdGraphPinType HeldType=Bool;HeldType.ContainerType=EPinContainerType::Array;TArray<FString> HeldDefaults;HeldDefaults.Init(TEXT("False"),256);B.Variable(TEXT("HeldCodes"),HeldType,TEXT("(")+FString::Join(HeldDefaults,TEXT(","))+TEXT(")"));
 if(NativeGame(Layer))GameVariables(B,Layer,Float);
 auto* Tick=B.Event(TEXT("ReceiveTick"));auto* TickSequence=B.Node<UK2Node_ExecutionSequence>();TickSequence->AllocateDefaultPins();if(NativeGame(Layer))TickSequence->AddInputPin();B.Connect(B.Pin(Tick,TEXT("then")),B.Pin(TickSequence,TEXT("execute")));
 auto* NeedBind=B.Branch(B.Unary(TEXT("Not_PreBool"),B.Get(TEXT("InputBound"))),TickSequence->GetThenPinGivenIndex(0));auto* Receiver=B.Call(USkinCreatorLibrary::StaticClass(),TEXT("GetKeyEventReceiver"));auto* Valid=B.Call(UKismetSystemLibrary::StaticClass(),TEXT("IsValid"));B.Input(Valid,TEXT("Object"),B.Pin(Receiver,TEXT("ReturnValue")));auto* ReceiverReady=B.Branch(B.Pin(Valid,TEXT("ReturnValue")),B.Pin(NeedBind,TEXT("then")));auto* Bind=B.Node<UK2Node_AddDelegate>();auto* Delegate=FindFProperty<FMulticastDelegateProperty>(UKeyEventReceiver::StaticClass(),TEXT("OnKeyEvent"));if(!Delegate)return nullptr;Bind->SetFromProperty(Delegate,false,UKeyEventReceiver::StaticClass());Bind->AllocateDefaultPins();
 auto* Key=B.Node<UK2Node_CustomEvent>();Key->CustomFunctionName=TEXT("StudioLayerKeyEvent");Key->AllocateDefaultPins();FEdGraphPinType Byte;Byte.PinCategory=UEdGraphSchema_K2::PC_Byte;FEdGraphPinType Int;Int.PinCategory=UEdGraphSchema_K2::PC_Int;Key->CreateUserDefinedPin(TEXT("HCode"),Byte,EGPD_Output);Key->CreateUserDefinedPin(TEXT("IsActuated"),Bool,EGPD_Output);Key->CreateUserDefinedPin(TEXT("Percentage"),Int,EGPD_Output);
 B.Connect(B.Pin(ReceiverReady,TEXT("then")),B.Pin(Bind,TEXT("execute")));B.Connect(B.Pin(Receiver,TEXT("ReturnValue")),B.Pin(Bind,TEXT("self")));B.Connect(B.Pin(Key,TEXT("OutputDelegate")),B.Pin(Bind,TEXT("Delegate")));B.Set(TEXT("InputBound"),FString(TEXT("True")),B.Pin(Bind,TEXT("then")));
 V Code=B.Pin(Key,TEXT("HCode")),Actuated=B.Pin(Key,TEXT("IsActuated")),Index=B.Unary(TEXT("Conv_ByteToInt"),Code,TEXT("InByte"));
 auto* HeldGet=B.Node<UK2Node_GetArrayItem>();HeldGet->AllocateDefaultPins();B.Connect(B.Get(TEXT("HeldCodes")).Pin,HeldGet->GetTargetArrayPin());B.Input(HeldGet,TEXT("Dimension 1"),Index);auto* Edge=B.Branch(B.Math(TEXT("NotEqual_BoolBool"),HeldGet->GetResultPin(),Actuated),B.Pin(Key,TEXT("then")));
 auto* HeldSet=B.Node<UK2Node_CallArrayFunction>();HeldSet->SetFromFunction(UKismetArrayLibrary::StaticClass()->FindFunctionByName(TEXT("Array_Set")));HeldSet->AllocateDefaultPins();B.Input(HeldSet,TEXT("TargetArray"),B.Get(TEXT("HeldCodes")));B.Input(HeldSet,TEXT("Index"),Index);B.Input(HeldSet,TEXT("Item"),Actuated);B.Connect(B.Pin(Edge,TEXT("then")),B.Pin(HeldSet,TEXT("execute")));
 auto* KeyPosition=B.Call(USkinCreatorLibrary::StaticClass(),TEXT("GetPositionByKeyIndex"));B.Input(KeyPosition,TEXT("KeyIndex"),Code);auto* Break=B.Call(UKismetMathLibrary::StaticClass(),TEXT("BreakVector2D"));B.Input(Break,TEXT("InVec"),B.Pin(KeyPosition,TEXT("ReturnValue")));
 const float ScaleX=Num(Layer,TEXT("nativePositionScaleX"),1),ScaleY=Num(Layer,TEXT("nativePositionScaleY"),1),OffsetX=Num(Layer,TEXT("nativePositionOffsetX"),0),OffsetY=Num(Layer,TEXT("nativePositionOffsetY"),0);
 V KeyX=Add(B,Mul(B,B.Pin(Break,TEXT("X")),ScaleX),OffsetX),KeyY=Add(B,Mul(B,B.Pin(Break,TEXT("Y")),ScaleY),OffsetY),WorldKey=B.Vector(Sub(B,KeyX,960.f),Sub(B,KeyY,275.f),Depth);
 auto* RuleSequence=B.Node<UK2Node_ExecutionSequence>();RuleSequence->AllocateDefaultPins();while(RuleSequence->Pins.Num()-1<Rules.Num()+(NativeGame(Layer)||Str(Layer,TEXT("type"))==TEXT("heatmap")?1:0))RuleSequence->AddInputPin();B.Connect(B.Pin(HeldSet,TEXT("then")),B.Pin(RuleSequence,TEXT("execute")));
 if(Str(Layer,TEXT("type"))==TEXT("heatmap"))HeatmapInput(B,Layer,Collection,Actuated,WorldKey,RuleSequence->GetThenPinGivenIndex(Rules.Num()));
 if(NativeGame(Layer)){GameInput(B,Layer,Actuated,KeyX,KeyY,RuleSequence->GetThenPinGivenIndex(Rules.Num()));GameTick(B,Layer,Collection,B.Pin(Tick,TEXT("DeltaSeconds")),TickSequence->GetThenPinGivenIndex(2));}
 for(int32 I=0;I<Rules.Num();I++)
 {
  auto R=Rules[I]->AsObject();if(!R.IsValid())return nullptr;FString Effect=Str(R,TEXT("effect")),Trigger=Str(R,TEXT("trigger"));V Match=Trigger==TEXT("keyUp")?B.Unary(TEXT("Not_PreBool"),Actuated):Actuated;
  const TArray<TSharedPtr<FJsonValue>>* Codes=nullptr;if(R->TryGetArrayField(TEXT("nativeKeys"),Codes)&&Codes->Num()){V Group(FString(TEXT("False")));for(const auto& Item:*Codes){auto* Eq=B.Call(UKismetMathLibrary::StaticClass(),TEXT("EqualEqual_ByteByte"));B.Input(Eq,TEXT("A"),Code);B.Input(Eq,TEXT("B"),FString::FromInt(FMath::Clamp(int32(Item->AsNumber()),0,255)));Group=B.Math(TEXT("BooleanOR"),Group,B.Pin(Eq,TEXT("ReturnValue")));}Match=B.Math(TEXT("BooleanAND"),Match,Group);}
  const TArray<TSharedPtr<FJsonValue>>* KeyRects=nullptr;if(R->TryGetArrayField(TEXT("nativeKeyRects"),KeyRects)&&KeyRects->Num()){V Group(FString(TEXT("False")));for(const auto& Item:*KeyRects){auto Rect=Item->AsObject();float Left=Num(Rect,TEXT("x"),0),Top=Num(Rect,TEXT("y"),0),Right=Left+Num(Rect,TEXT("width"),0),Bottom=Top+Num(Rect,TEXT("height"),0);V InX=B.Math(TEXT("BooleanAND"),B.Math(TEXT("GreaterEqual_FloatFloat"),KeyX,Left),B.Math(TEXT("Less_FloatFloat"),KeyX,Right)),InY=B.Math(TEXT("BooleanAND"),B.Math(TEXT("GreaterEqual_FloatFloat"),KeyY,Top),B.Math(TEXT("Less_FloatFloat"),KeyY,Bottom));Group=B.Math(TEXT("BooleanOR"),Group,B.Math(TEXT("BooleanAND"),InX,InY));}Match=B.Math(TEXT("BooleanAND"),Match,Group);}
  auto* RuleBranch=B.Branch(Match,RuleSequence->GetThenPinGivenIndex(I));UEdGraphPin* Exec=B.Pin(RuleBranch,TEXT("then"));FString Prefix=FString::Printf(TEXT("R%d_"),I);const float Strength=FMath::Clamp(Num(R,TEXT("strength"),1)*Num(Layer,TEXT("reactivity"),1),0.f,8.f);
  if(Effect==TEXT("flee"))
  {
   V Location=B.Pin(B.Call(AActor::StaticClass(),TEXT("K2_GetActorLocation")),TEXT("ReturnValue")),Away=B.Math(TEXT("Subtract_VectorVector"),Location,WorldKey),Distance=B.Unary(TEXT("VSizeXY"),Away),Radius=Num(R,TEXT("radius"),260);
   auto* Near=B.Branch(B.Math(TEXT("Less_FloatFloat"),Distance,Radius),Exec);Exec=B.Pin(Near,TEXT("then"));
   const float Angle=Rand(uint32(Num(Layer,TEXT("seed"),1729)),31)*2*PI;V Biased=B.Math(TEXT("Add_VectorVector"),Away,B.Vector(FMath::Cos(Angle)*.001f,FMath::Sin(Angle)*.001f,0.f));auto* Normalize=B.Call(UKismetMathLibrary::StaticClass(),TEXT("Normal"));B.Input(Normalize,TEXT("A"),Biased);B.Input(Normalize,TEXT("Tolerance"),FString(TEXT("0.000000000001")));V Direction=B.Pin(Normalize,TEXT("ReturnValue"));
   V Falloff=Sub(B,1.f,Smooth(B,Div(B,Distance,Radius))),DistanceOut=Mul(B,FMath::Min(600.f,Num(R,TEXT("distance"),180)*Strength),Falloff),Goal=B.Math(TEXT("Multiply_VectorFloat"),Direction,DistanceOut);
   auto* DirectionParts=B.Call(UKismetMathLibrary::StaticClass(),TEXT("BreakVector"));B.Input(DirectionParts,TEXT("InVec"),Direction);auto* EscapeAngle=B.Call(UKismetMathLibrary::StaticClass(),TEXT("DegAtan2"));B.Input(EscapeAngle,TEXT("X"),B.Pin(DirectionParts,TEXT("X")));B.Input(EscapeAngle,TEXT("Y"),B.Pin(DirectionParts,TEXT("Y")));
   Exec=B.Set(TEXT("FleeYaw"),B.Pin(EscapeAngle,TEXT("ReturnValue")),Exec);Exec=B.Set(TEXT("FleeGoal"),Goal,Exec);Exec=B.Set(TEXT("FleeDuration"),Num(R,TEXT("duration"),1.4f),Exec);Exec=B.Set(TEXT("FleeTime"),B.Time(),Exec);
  }
  else if(Effect==TEXT("toggle"))
  {
   Exec=B.Set(TEXT("SkinVisible"),B.Unary(TEXT("Not_PreBool"),B.Get(TEXT("SkinVisible"))),Exec);auto* Hidden=B.Call(AActor::StaticClass(),TEXT("SetActorHiddenInGame"));B.Input(Hidden,TEXT("bNewHidden"),B.Unary(TEXT("Not_PreBool"),B.Get(TEXT("SkinVisible"))));B.Connect(Exec,B.Pin(Hidden,TEXT("execute")));
  }
  else{Exec=B.Parameter(Collection,Prefix+TEXT("Time"),B.Time(),Exec);Exec=B.Parameter(Collection,Prefix+TEXT("X"),KeyX,Exec);Exec=B.Parameter(Collection,Prefix+TEXT("Y"),KeyY,Exec);Exec=B.Parameter(Collection,Prefix+TEXT("Strength"),Strength,Exec);
   if(Effect!=TEXT("pulse")&&Effect!=TEXT("launch")){
    FString Cursor=FString::Printf(TEXT("EventCursor%d"),I);auto* String=B.Call(UKismetStringLibrary::StaticClass(),TEXT("Conv_IntToString"));B.Input(String,TEXT("InInt"),B.Get(*Cursor));auto* Start=B.Call(UKismetStringLibrary::StaticClass(),TEXT("Concat_StrStr"));B.Input(Start,TEXT("A"),Prefix+TEXT("H"));B.Input(Start,TEXT("B"),B.Pin(String,TEXT("ReturnValue")));
    auto Store=[&](const TCHAR* Field,V Value){auto* Join=B.Call(UKismetStringLibrary::StaticClass(),TEXT("Concat_StrStr"));B.Input(Join,TEXT("A"),B.Pin(Start,TEXT("ReturnValue")));B.Input(Join,TEXT("B"),FString(TEXT("_"))+Field);auto* Name=B.Call(UKismetStringLibrary::StaticClass(),TEXT("Conv_StringToName"));B.Input(Name,TEXT("InString"),B.Pin(Join,TEXT("ReturnValue")));Exec=B.NamedParameter(Collection,B.Pin(Name,TEXT("ReturnValue")),Value,Exec);};
    Store(TEXT("Time"),B.Time());Store(TEXT("X"),KeyX);Store(TEXT("Y"),KeyY);Store(TEXT("Strength"),Strength);Exec=B.Set(*Cursor,B.Math(TEXT("Percent_IntInt"),B.Math(TEXT("Add_IntInt"),B.Get(*Cursor),FString(TEXT("1"))),FString(TEXT("4"))),Exec);
   }
  }
 }
 V Time=B.Time(),Clock=Flag(Layer,TEXT("nativeLoop"),true)?B.Math(TEXT("Percent_FloatFloat"),Time,Num(Layer,TEXT("nativeDuration"),12)):Time;V TrackW=Timeline(B,Layer,TEXT("width"),Clock,Width),TrackH=Timeline(B,Layer,TEXT("height"),Clock,Height),TrackX=Sub(B,Add(B,Timeline(B,Layer,TEXT("x"),Clock,0),Mul(B,TrackW,.5f)),960.f),TrackY=Sub(B,Add(B,Timeline(B,Layer,TEXT("y"),Clock,0),Mul(B,TrackH,.5f)),275.f);V DX(0.f),DY(0.f),Yaw=Timeline(B,Layer,TEXT("rotation"),Clock,Rotation);const TSharedPtr<FJsonObject>* MotionPtr=nullptr;TSharedPtr<FJsonObject> Motion;if(Layer->TryGetObjectField(TEXT("motion"),MotionPtr))Motion=*MotionPtr;FString Type=Str(Motion,TEXT("type"),TEXT("none"));const float Speed=Num(Motion,TEXT("speed"),1),Distance=Num(Motion,TEXT("distance"),80);const uint32 Seed=uint32(Num(Layer,TEXT("seed"),1729));
 if(Type!=TEXT("none")&&Speed>0&&Distance>0)
 {
  const float Phase=Rand(Seed,21)*2*PI,Rate=Speed*(Type==TEXT("drift")?.17f:Type==TEXT("orbit")?.24f:.32f)*(.85f+Rand(Seed,22)*.3f);V U=Add(B,Phase,Mul(B,Time,Rate)),Sin=B.Unary(TEXT("Sin"),U),Cos=B.Unary(TEXT("Cos"),U),VX,VY;
  if(Type==TEXT("orbit")){DX=Mul(B,.5f*Distance,Sub(B,Cos,FMath::Cos(Phase)));DY=Mul(B,.5f*Distance,Sub(B,Sin,FMath::Sin(Phase)));VX=Mul(B,-1.f,Sin);VY=Cos;}
  else if(Type==TEXT("swim")){DX=Mul(B,.45f*Distance,Sub(B,Sin,FMath::Sin(Phase)));DY=Mul(B,.17f*Distance,Sub(B,B.Unary(TEXT("Sin"),Mul(B,U,2.f)),FMath::Sin(2*Phase)));VX=Mul(B,.45f,Cos);VY=Mul(B,.34f,B.Unary(TEXT("Cos"),Mul(B,U,2.f)));}
  else{DX=Mul(B,.4f*Distance,Sub(B,Sin,FMath::Sin(Phase)));DY=Mul(B,.25f*Distance,Sub(B,Cos,FMath::Cos(Phase)));VX=Mul(B,.4f,Cos);VY=Mul(B,-.25f,Sin);}
  V A=Mul(B,Yaw,PI/180.f),CosA=B.Unary(TEXT("Cos"),A),SinA=B.Unary(TEXT("Sin"),A);V RX=Sub(B,Mul(B,DX,CosA),Mul(B,DY,SinA)),RY=Add(B,Mul(B,DX,SinA),Mul(B,DY,CosA));DX=RX;DY=RY;
  if(Flag(Motion,TEXT("turn"),true)){auto* Angle=B.Call(UKismetMathLibrary::StaticClass(),TEXT("DegAtan2"));B.Input(Angle,TEXT("X"),VX);B.Input(Angle,TEXT("Y"),VY);Yaw=Add(B,Yaw,B.Pin(Angle,TEXT("ReturnValue")));}
 }
 V Age=Sub(B,Time,B.Get(TEXT("FleeTime"))),Progress=B.Clamp(Div(B,Age,B.Get(TEXT("FleeDuration")))),Fade=Mul(B,Sub(B,1.f,Progress),Sub(B,1.f,Progress));auto* Interp=B.Call(UKismetMathLibrary::StaticClass(),TEXT("VInterpTo"));B.Input(Interp,TEXT("Current"),B.Get(TEXT("CurrentOffset")));B.Input(Interp,TEXT("Target"),B.Math(TEXT("Multiply_VectorFloat"),B.Get(TEXT("FleeGoal")),Fade));B.Input(Interp,TEXT("DeltaTime"),B.Pin(Tick,TEXT("DeltaSeconds")));B.Input(Interp,TEXT("InterpSpeed"),12.f);
 V Facing=B.Rotator(Yaw);
 if(Flag(Motion,TEXT("turn"),true)&&(Type!=TEXT("none")||Str(Layer,TEXT("type"))==TEXT("fish"))){auto* EscapeFacing=B.Call(UKismetMathLibrary::StaticClass(),TEXT("RLerp"));B.Input(EscapeFacing,TEXT("A"),Facing);B.Input(EscapeFacing,TEXT("B"),B.Rotator(B.Get(TEXT("FleeYaw"))));B.Input(EscapeFacing,TEXT("Alpha"),B.Clamp(Mul(B,Fade,3.f)));B.Input(EscapeFacing,TEXT("bShortestPath"),FString(TEXT("True")));auto* SmoothFacing=B.Call(UKismetMathLibrary::StaticClass(),TEXT("RInterpTo"));B.Input(SmoothFacing,TEXT("Current"),B.Pin(B.Call(AActor::StaticClass(),TEXT("K2_GetActorRotation")),TEXT("ReturnValue")));B.Input(SmoothFacing,TEXT("Target"),B.Pin(EscapeFacing,TEXT("ReturnValue")));B.Input(SmoothFacing,TEXT("DeltaTime"),B.Pin(Tick,TEXT("DeltaSeconds")));B.Input(SmoothFacing,TEXT("InterpSpeed"),10.f);Facing=B.Pin(SmoothFacing,TEXT("ReturnValue"));}
 UEdGraphPin* Exec=B.Set(TEXT("CurrentOffset"),B.Pin(Interp,TEXT("ReturnValue")),TickSequence->GetThenPinGivenIndex(1));V Position=B.Math(TEXT("Add_VectorVector"),B.Vector(Add(B,TrackX,DX),Add(B,TrackY,DY),Depth),B.Get(TEXT("CurrentOffset")));auto* SetTransform=B.Call(AActor::StaticClass(),TEXT("K2_SetActorLocationAndRotation"));B.Input(SetTransform,TEXT("NewLocation"),Position);B.Input(SetTransform,TEXT("NewRotation"),Facing);B.Connect(Exec,B.Pin(SetTransform,TEXT("execute")));Exec=B.Pin(SetTransform,TEXT("then"));
 V Pulse(1.f);for(int32 I=0;I<Rules.Num();I++){auto R=Rules[I]->AsObject();if(Str(R,TEXT("effect"))!=TEXT("pulse"))continue;V P=B.Clamp(Div(B,Sub(B,Time,B.ReadParameter(Collection,FString::Printf(TEXT("R%d_Time"),I),Exec)),Num(R,TEXT("duration"),1.4f)));V Curve=Mul(B,B.Unary(TEXT("Sin"),Mul(B,P,PI)),Sub(B,1.f,P));Pulse=Add(B,Pulse,Mul(B,Curve,Num(R,TEXT("strength"),1)*Num(Layer,TEXT("reactivity"),1)*.1f));}auto* SetScale=B.Call(AActor::StaticClass(),TEXT("SetActorScale3D"));B.Input(SetScale,TEXT("NewScale3D"),B.Vector(Mul(B,Pulse,Div(B,TrackW,Width)),Mul(B,Pulse,Div(B,TrackH,Height)),1.f));B.Connect(Exec,B.Pin(SetScale,TEXT("execute")));
 if(Flag(Layer,TEXT("nativeComposite"),false)){
  Exec=B.Pin(SetScale,TEXT("then"));auto* P=B.Call(UKismetMathLibrary::StaticClass(),TEXT("BreakVector"));B.Input(P,TEXT("InVec"),Position);auto* R=B.Call(UKismetMathLibrary::StaticClass(),TEXT("BreakRotator"));B.Input(R,TEXT("InRot"),Facing);
  Exec=B.Parameter(Collection,TEXT("CP_X"),Add(B,B.Pin(P,TEXT("X")),960.f),Exec);Exec=B.Parameter(Collection,TEXT("CP_Y"),Add(B,B.Pin(P,TEXT("Y")),275.f),Exec);
  Exec=B.Parameter(Collection,TEXT("CP_W"),Mul(B,Pulse,TrackW),Exec);Exec=B.Parameter(Collection,TEXT("CP_H"),Mul(B,Pulse,TrackH),Exec);Exec=B.Parameter(Collection,TEXT("CP_R"),B.Pin(R,TEXT("Yaw")),Exec);
  Exec=B.Parameter(Collection,TEXT("CP_V"),B.Unary(TEXT("Conv_BoolToFloat"),B.Get(TEXT("SkinVisible")),TEXT("InBool")),Exec);
 }
 if(!B.Good)return nullptr;FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(BP);FKismetEditorUtilities::CompileBlueprint(BP);if(BP->Status==BS_Error)return nullptr;
 if(auto* CDO=Cast<AActor>(BP->GeneratedClass->GetDefaultObject())){CDO->PrimaryActorTick.bCanEverTick=true;CDO->PrimaryActorTick.bStartWithTickEnabled=true;CDO->SetActorHiddenInGame(!Flag(Layer,TEXT("visible"),true));}
 FAssetRegistryModule::AssetCreated(BP);Package->MarkPackageDirty();return BP;
}

UBlueprint* USkinStudioDeviceBuilder::CreateCompositorBlueprint(const TArray<UMaterialInterface*>& Materials,UMaterialInterface* DisplayMaterial)
{
 using namespace StudioLayerBuilder;
 if(Materials.Num()<1||Materials.Num()>65||!DisplayMaterial)return nullptr;
 for(auto* Material:Materials)if(!Material)return nullptr;
 const FString Name=TEXT("BP_StudioComposite"),Path=TEXT("/Game/Companion/")+Name;
 if(LoadObject<UObject>(nullptr,*(Path+TEXT(".")+Name)))return nullptr;
 UPackage* Package=CreatePackage(*Path);auto* BP=FKismetEditorUtilities::CreateBlueprint(AActor::StaticClass(),Package,FName(*Name),BPTYPE_Normal,UBlueprint::StaticClass(),UBlueprintGeneratedClass::StaticClass());
 if(!BP||BP->UbergraphPages.Num()!=1)return nullptr;
 auto* Root=BP->SimpleConstructionScript->CreateNode(UStaticMeshComponent::StaticClass(),TEXT("CompositeScreen"));auto* Mesh=Cast<UStaticMeshComponent>(Root->ComponentTemplate);
 auto* Plane=LoadObject<UStaticMesh>(nullptr,TEXT("/Game/Companion/Meshes/Plane.Plane"));if(!Plane)return nullptr;
 Mesh->SetStaticMesh(Plane);Mesh->SetMaterial(0,DisplayMaterial);Mesh->SetRelativeScale3D(FVector(19.2,5.5,1));Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);Mesh->SetCastShadow(false);Mesh->SetMobility(EComponentMobility::Movable);BP->SimpleConstructionScript->AddNode(Root);
 Graph B(BP);FEdGraphPinType RT;RT.PinCategory=UEdGraphSchema_K2::PC_Object;RT.PinSubCategoryObject=UTextureRenderTarget2D::StaticClass();FEdGraphPinType MID=RT;MID.PinSubCategoryObject=UMaterialInstanceDynamic::StaticClass();FEdGraphPinType Bool;Bool.PinCategory=UEdGraphSchema_K2::PC_Boolean;
 B.Variable(TEXT("FrameA"),RT,TEXT("None"));B.Variable(TEXT("FrameB"),RT,TEXT("None"));B.Variable(TEXT("Ready"),Bool,TEXT("False"));B.Variable(TEXT("DisplayMID"),MID,TEXT("None"));
 for(int32 I=0;I<Materials.Num();I++)B.Variable(*FString::Printf(TEXT("LayerMID%d"),I),MID,TEXT("None"));
 FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(BP);FKismetEditorUtilities::CompileBlueprint(BP);if(BP->Status==BS_Error)return nullptr;
 auto* Begin=B.Event(TEXT("ReceiveBeginPlay"));UEdGraphPin* Exec=B.Pin(Begin,TEXT("then"));
 for(const TCHAR* Target:{TEXT("FrameA"),TEXT("FrameB")}){
  auto* Create=B.Call(UKismetRenderingLibrary::StaticClass(),TEXT("CreateRenderTarget2D"));B.Input(Create,TEXT("Width"),FString(TEXT("1920")));B.Input(Create,TEXT("Height"),FString(TEXT("550")));B.Input(Create,TEXT("Format"),FString(TEXT("RTF_RGBA16f")));B.Connect(Exec,B.Pin(Create,TEXT("execute")));Exec=B.Set(Target,B.Pin(Create,TEXT("ReturnValue")),B.Pin(Create,TEXT("then")));
 }
 for(int32 I=0;I<=Materials.Num();I++){
  const bool Display=I==Materials.Num();const FString Variable=Display?TEXT("DisplayMID"):FString::Printf(TEXT("LayerMID%d"),I);
  auto* Create=B.Call(UKismetMaterialLibrary::StaticClass(),TEXT("CreateDynamicMaterialInstance"));B.Pin(Create,TEXT("Parent"))->DefaultObject=Display?DisplayMaterial:Materials[I];B.Connect(Exec,B.Pin(Create,TEXT("execute")));Exec=B.Set(*Variable,B.Pin(Create,TEXT("ReturnValue")),B.Pin(Create,TEXT("then")));
  auto* Texture=B.Call(UMaterialInstanceDynamic::StaticClass(),TEXT("SetTextureParameterValue"));B.Input(Texture,TEXT("self"),B.Get(*Variable));B.Input(Texture,TEXT("ParameterName"),FString(Display?TEXT("FinalFrame"):TEXT("PreviousFrame")));B.Input(Texture,TEXT("Value"),B.Get(Display?(Materials.Num()%2?TEXT("FrameB"):TEXT("FrameA")):(I%2?TEXT("FrameB"):TEXT("FrameA"))));B.Connect(Exec,B.Pin(Texture,TEXT("execute")));Exec=B.Pin(Texture,TEXT("then"));
 }
 auto* Assign=B.Call(UPrimitiveComponent::StaticClass(),TEXT("SetMaterial"));B.Input(Assign,TEXT("self"),B.Get(TEXT("CompositeScreen")));B.Input(Assign,TEXT("ElementIndex"),FString(TEXT("0")));B.Input(Assign,TEXT("Material"),B.Get(TEXT("DisplayMID")));B.Connect(Exec,B.Pin(Assign,TEXT("execute")));B.Set(TEXT("Ready"),FString(TEXT("True")),B.Pin(Assign,TEXT("then")));
 auto* Tick=B.Event(TEXT("ReceiveTick"));auto* Ready=B.Branch(B.Get(TEXT("Ready")),B.Pin(Tick,TEXT("then")));auto* Clear=B.Call(UKismetRenderingLibrary::StaticClass(),TEXT("ClearRenderTarget2D"));B.Input(Clear,TEXT("TextureRenderTarget"),B.Get(TEXT("FrameA")));B.Connect(B.Pin(Ready,TEXT("then")),B.Pin(Clear,TEXT("execute")));Exec=B.Pin(Clear,TEXT("then"));
 for(int32 I=0;I<Materials.Num();I++){
  auto* Draw=B.Call(UKismetRenderingLibrary::StaticClass(),TEXT("DrawMaterialToRenderTarget"));B.Input(Draw,TEXT("TextureRenderTarget"),B.Get(I%2?TEXT("FrameA"):TEXT("FrameB")));B.Input(Draw,TEXT("Material"),B.Get(*FString::Printf(TEXT("LayerMID%d"),I)));B.Connect(Exec,B.Pin(Draw,TEXT("execute")));Exec=B.Pin(Draw,TEXT("then"));
 }
 if(!B.Good)return nullptr;FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(BP);FKismetEditorUtilities::CompileBlueprint(BP);if(BP->Status==BS_Error)return nullptr;
 if(auto* CDO=Cast<AActor>(BP->GeneratedClass->GetDefaultObject())){CDO->PrimaryActorTick.bCanEverTick=true;CDO->PrimaryActorTick.bStartWithTickEnabled=true;CDO->PrimaryActorTick.TickGroup=TG_PostUpdateWork;}
 FAssetRegistryModule::AssetCreated(BP);Package->MarkPackageDirty();return BP;
}
