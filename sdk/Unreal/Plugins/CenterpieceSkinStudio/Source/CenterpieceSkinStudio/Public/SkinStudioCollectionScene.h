#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SkinStudioCollectionScene.generated.h"
class UCameraComponent;
class UStaticMeshComponent;
class USkinStudioRuntime;
struct FStudioLayerFrame;

// Original procedural scene source. Compiles inside the exported Unreal project;
// it is not a module that can be injected into Finalmouse's existing runtime.
UCLASS(BlueprintType)
class CENTERPIECESKINSTUDIO_API ASkinStudioCollectionScene : public AActor
{
    GENERATED_BODY()
public:
    ASkinStudioCollectionScene();
    bool Configure(const FStudioLayerFrame& Layer, USkinStudioRuntime* InRuntime);
    virtual void Tick(float DeltaSeconds) override;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Skin Studio") UCameraComponent* Camera;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FString SceneId;
private:
    UPROPERTY() USkinStudioRuntime* Runtime;
    UPROPERTY() TArray<UStaticMeshComponent*> Parts;
    TArray<FVector> Homes;
    TArray<FString> Motions;
    FString LayerId;
    float LastTriggerAt = -1000;
    float AnimationTime = 0;
    UStaticMeshComponent* Part(const TCHAR* Shape, FVector Position, FVector Scale, FLinearColor Color, const TCHAR* Motion=TEXT(""), FRotator Rotation=FRotator::ZeroRotator);
    void Landscape(const FString& Kind);
    void ConstructScene();
};
