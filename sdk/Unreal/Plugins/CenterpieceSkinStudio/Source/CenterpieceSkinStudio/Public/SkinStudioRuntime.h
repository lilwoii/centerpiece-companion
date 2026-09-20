#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "SkinStudioRuntime.generated.h"
class UCanvas;
class FJsonObject;

USTRUCT(BlueprintType)
struct CENTERPIECESKINSTUDIO_API FStudioLayerFrame
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FString Id;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FString Type;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FString Text;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FVector2D Position = FVector2D::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FVector2D Size = FVector2D(1920, 550);
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") float Rotation = 0;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") float Opacity = 1;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FLinearColor Color = FLinearColor::White;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FLinearColor Color2 = FLinearColor::Blue;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") float Speed = 1;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") float Reactivity = 1;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") float ParticleSize = 24;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") float FontSize = 72;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") int32 Density = 40;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") int32 Seed = 1;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") bool Visible = true;
};

USTRUCT(BlueprintType)
struct CENTERPIECESKINSTUDIO_API FStudioEffectEvent
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FString Target;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FString Effect;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FVector2D Position = FVector2D::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FLinearColor Color = FLinearColor::White;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") float Strength = 1;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") float Duration = 1;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") float StartedAt = 0;
};

UCLASS(ClassGroup=(Community), meta=(BlueprintSpawnableComponent))
class CENTERPIECESKINSTUDIO_API USkinStudioRuntime : public UActorComponent
{
    GENERATED_BODY()
public:
    USkinStudioRuntime();
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FString ProjectName;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") FString LastError;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") TArray<FString> PreviewWarnings;
    UPROPERTY(BlueprintReadOnly, Category="Skin Studio") float Playhead = 0;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Skin Studio") bool Playing = true;
    UFUNCTION(BlueprintCallable, Category="Skin Studio") bool LoadProjectJson(const FString& Json, FString& Error);
    UFUNCTION(BlueprintCallable, Category="Skin Studio") bool LoadBundledProject(FString& Error);
    UFUNCTION(BlueprintCallable, Category="Skin Studio") void NotifyInput(const FString& Trigger, const FString& Key, FVector2D Position, float Strength = 1);
    UFUNCTION(BlueprintCallable, Category="Skin Studio") void Seek(float Seconds);
    UFUNCTION(BlueprintPure, Category="Skin Studio") TArray<FStudioLayerFrame> EvaluateLayers(float Seconds) const;
    UFUNCTION(BlueprintPure, Category="Skin Studio") TArray<FStudioEffectEvent> GetActiveEffects() const;
    UFUNCTION(BlueprintPure, Category="Skin Studio") float GetElapsedSeconds() const { return RuntimeSeconds; }
    UFUNCTION(BlueprintCallable, Category="Skin Studio") void DrawToCanvas(UCanvas* Canvas);
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* TickFunction) override;
private:
    TSharedPtr<FJsonObject> Document;
    TMap<FString, bool> ToggleStates;
    TArray<FStudioEffectEvent> Effects;
    float RuntimeSeconds = 0;
    float Duration = 12;
    FLinearColor Background = FLinearColor::Black;
};
