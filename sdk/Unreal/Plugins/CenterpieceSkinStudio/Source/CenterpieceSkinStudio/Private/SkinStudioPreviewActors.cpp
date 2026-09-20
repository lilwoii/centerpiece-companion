#include "SkinStudioPreviewActors.h"
#include "SkinStudioRuntime.h"
#include "SkinStudioCollectionScene.h"
#include "Components/InputComponent.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "InputCoreTypes.h"

namespace
{
FString StudioCode(FKey Key)
{
    const FString Name=Key.GetFName().ToString();
    if(Name.Len()==1&&Name[0]>='A'&&Name[0]<='Z')return TEXT("Key")+Name;
    const TMap<FString,FString> Names={{TEXT("Zero"),TEXT("Digit0")},{TEXT("One"),TEXT("Digit1")},{TEXT("Two"),TEXT("Digit2")},{TEXT("Three"),TEXT("Digit3")},{TEXT("Four"),TEXT("Digit4")},{TEXT("Five"),TEXT("Digit5")},{TEXT("Six"),TEXT("Digit6")},{TEXT("Seven"),TEXT("Digit7")},{TEXT("Eight"),TEXT("Digit8")},{TEXT("Nine"),TEXT("Digit9")},{TEXT("SpaceBar"),TEXT("Space")},{TEXT("Up"),TEXT("ArrowUp")},{TEXT("Down"),TEXT("ArrowDown")},{TEXT("Left"),TEXT("ArrowLeft")},{TEXT("Right"),TEXT("ArrowRight")},{TEXT("BackSpace"),TEXT("Backspace")},{TEXT("LeftShift"),TEXT("ShiftLeft")},{TEXT("RightShift"),TEXT("ShiftRight")},{TEXT("LeftControl"),TEXT("ControlLeft")},{TEXT("RightControl"),TEXT("ControlRight")},{TEXT("LeftAlt"),TEXT("AltLeft")},{TEXT("RightAlt"),TEXT("AltRight")},{TEXT("Hyphen"),TEXT("Minus")},{TEXT("Equals"),TEXT("Equal")},{TEXT("Tilde"),TEXT("Backquote")},{TEXT("LeftBracket"),TEXT("BracketLeft")},{TEXT("RightBracket"),TEXT("BracketRight")},{TEXT("Backslash"),TEXT("Backslash")},{TEXT("Apostrophe"),TEXT("Quote")}};
    const auto* Code=Names.Find(Name);return Code?*Code:Name;
}
}

ASkinStudioPreviewHUD::ASkinStudioPreviewHUD() { Studio = CreateDefaultSubobject<USkinStudioRuntime>(TEXT("StudioRuntime")); }
void ASkinStudioPreviewHUD::BeginPlay()
{
    Super::BeginPlay(); FString Error; if(!Studio->LoadBundledProject(Error))return;
    for(const auto& Layer:Studio->EvaluateLayers(0))if(Layer.Type==TEXT("collection"))
    {
        CollectionScene=GetWorld()->SpawnActor<ASkinStudioCollectionScene>();
        if(CollectionScene&&CollectionScene->Configure(Layer,Studio)){if(PlayerOwner)PlayerOwner->SetViewTarget(CollectionScene);}
        else {if(CollectionScene)CollectionScene->Destroy();CollectionScene=nullptr;}
        break;
    }
}
void ASkinStudioPreviewHUD::DrawHUD()
{
    Super::DrawHUD(); if (!Canvas) return;
    if(!CollectionScene)Studio->DrawToCanvas(Canvas);
    if (!Studio->LastError.IsEmpty()) Canvas->K2_DrawText(GEngine ? GEngine->GetSmallFont() : nullptr, Studio->LastError, FVector2D(20,20), FVector2D(1,1), FLinearColor::Red, 0, FLinearColor::Black, FVector2D::ZeroVector, false, false, false, FLinearColor::Black);
}
ASkinStudioPreviewController::ASkinStudioPreviewController() { bShowMouseCursor = true; }
void ASkinStudioPreviewController::SetupInputComponent()
{
    Super::SetupInputComponent();
    TArray<FKey> Keys;for(TCHAR Letter='A';Letter<='Z';++Letter)Keys.Add(FKey(FName(*FString::Chr(Letter))));
    const TCHAR* Additional[]={TEXT("Zero"),TEXT("One"),TEXT("Two"),TEXT("Three"),TEXT("Four"),TEXT("Five"),TEXT("Six"),TEXT("Seven"),TEXT("Eight"),TEXT("Nine"),TEXT("SpaceBar"),TEXT("Enter"),TEXT("Tab"),TEXT("CapsLock"),TEXT("Escape"),TEXT("BackSpace"),TEXT("Up"),TEXT("Down"),TEXT("Left"),TEXT("Right"),TEXT("LeftShift"),TEXT("RightShift"),TEXT("LeftControl"),TEXT("RightControl"),TEXT("LeftAlt"),TEXT("RightAlt"),TEXT("Semicolon"),TEXT("Apostrophe"),TEXT("Comma"),TEXT("Period"),TEXT("Slash"),TEXT("Backslash"),TEXT("LeftBracket"),TEXT("RightBracket"),TEXT("Hyphen"),TEXT("Equals"),TEXT("Tilde")};
    for(const TCHAR* Name:Additional)Keys.Add(FKey(FName(Name)));
    for(int32 I=1;I<=12;++I)Keys.Add(FKey(FName(*FString::Printf(TEXT("F%d"),I))));
    for(const FKey& Key:Keys){InputComponent->BindKey(Key,IE_Pressed,this,&ASkinStudioPreviewController::PreviewKeyDown);InputComponent->BindKey(Key,IE_Released,this,&ASkinStudioPreviewController::PreviewKeyUp);}
    InputComponent->BindAction(TEXT("StudioPointer"), IE_Pressed, this, &ASkinStudioPreviewController::Pointer);
    InputComponent->BindAction(TEXT("StudioBeat"), IE_Pressed, this, &ASkinStudioPreviewController::Beat);
    InputComponent->BindAction(TEXT("StudioCaps"), IE_Pressed, this, &ASkinStudioPreviewController::Caps);
}
void ASkinStudioPreviewController::SendStudioInput(const FString& Trigger, const FString& Key, FVector2D Position, float Strength)
{ if (auto* HUD = Cast<ASkinStudioPreviewHUD>(GetHUD())) HUD->Studio->NotifyInput(Trigger, Key, Position, Strength); }
void ASkinStudioPreviewController::PreviewKeyDown(FKey Key) { SendStudioInput(TEXT("keyDown"),StudioCode(Key),FVector2D(960,275),1); }
void ASkinStudioPreviewController::PreviewKeyUp(FKey Key) { SendStudioInput(TEXT("keyUp"),StudioCode(Key),FVector2D(960,275),1); }
void ASkinStudioPreviewController::ADown() { SendStudioInput(TEXT("keyDown"), TEXT("KeyA"), FVector2D(180,280), 1); }
void ASkinStudioPreviewController::AUp() { SendStudioInput(TEXT("keyUp"), TEXT("KeyA"), FVector2D(180,280), 1); }
void ASkinStudioPreviewController::SpaceDown() { SendStudioInput(TEXT("keyDown"), TEXT("Space"), FVector2D(850,450), 1); }
void ASkinStudioPreviewController::SpaceUp() { SendStudioInput(TEXT("keyUp"), TEXT("Space"), FVector2D(850,450), 1); }
void ASkinStudioPreviewController::Pointer()
{
    float X, Y; int32 Width, Height; if (!GetMousePosition(X,Y)) return; GetViewportSize(Width,Height);
    const float Scale = FMath::Min(Width / 1920.f, Height / 550.f); if (Scale <= 0) return;
    SendStudioInput(TEXT("pointer"), TEXT("any"), FVector2D((X - (Width - 1920 * Scale) / 2) / Scale, (Y - (Height - 550 * Scale) / 2) / Scale), 1);
}
void ASkinStudioPreviewController::Beat() { SendStudioInput(TEXT("beat"), TEXT("any"), FVector2D(960,275), 1); }
void ASkinStudioPreviewController::Caps() { CapsState = !CapsState; SendStudioInput(TEXT("caps"), TEXT("CapsLock"), FVector2D(100,280), CapsState ? 1 : 0); }
ASkinStudioGameMode::ASkinStudioGameMode() { HUDClass = ASkinStudioPreviewHUD::StaticClass(); PlayerControllerClass = ASkinStudioPreviewController::StaticClass(); DefaultPawnClass = nullptr; }
