#pragma once
#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/GameModeBase.h"
#include "SkinStudioPreviewActors.generated.h"
class USkinStudioRuntime;
class ASkinStudioCollectionScene;

UCLASS()
class CENTERPIECESKINSTUDIO_API ASkinStudioPreviewHUD : public AHUD
{
    GENERATED_BODY()
public:
    ASkinStudioPreviewHUD();
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Skin Studio") USkinStudioRuntime* Studio;
    UPROPERTY() ASkinStudioCollectionScene* CollectionScene;
    virtual void BeginPlay() override;
    virtual void DrawHUD() override;
};

UCLASS()
class CENTERPIECESKINSTUDIO_API ASkinStudioPreviewController : public APlayerController
{
    GENERATED_BODY()
public:
    ASkinStudioPreviewController();
    virtual void SetupInputComponent() override;
    UFUNCTION(BlueprintCallable, Category="Skin Studio") void SendStudioInput(const FString& Trigger, const FString& Key, FVector2D Position, float Strength = 1);
private:
    void PreviewKeyDown(FKey Key); void PreviewKeyUp(FKey Key);
    void ADown(); void AUp(); void SpaceDown(); void SpaceUp(); void Pointer(); void Beat(); void Caps();
    bool CapsState = false;
};

UCLASS()
class CENTERPIECESKINSTUDIO_API ASkinStudioGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    ASkinStudioGameMode();
};
