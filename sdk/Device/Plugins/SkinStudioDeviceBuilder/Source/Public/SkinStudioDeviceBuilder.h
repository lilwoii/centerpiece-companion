#pragma once
#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "Templates/SubclassOf.h"
#include "GameFramework/Actor.h"
#include "SkinStudioDeviceBuilder.generated.h"
class UBlueprint;
class UMaterialParameterCollection;
class UMaterialInterface;
class UFont;
class AActor;
class UStaticMesh;
class UMaterial;
class UMaterialExpression;
UCLASS()
class SKINSTUDIODEVICEBUILDER_API USkinStudioDeviceBuilder:public UBlueprintFunctionLibrary
{
 GENERATED_BODY()
 public:
 UFUNCTION(BlueprintCallable,Category="Studio Device Builder") static UStaticMesh* CreateParticleMesh(int32 Count, int64 Seed, const FString& AssetName);
 UFUNCTION(BlueprintCallable,Category="Studio Device Builder") static bool ConnectParticleVertex(UMaterial* Material, UMaterialExpression* Offset, UMaterialExpression* Coordinates);
 UFUNCTION(BlueprintCallable,Category="Studio Device Builder") static bool ConnectHeatmapData(UMaterial* Material, UMaterialExpression* Data);
 UFUNCTION(BlueprintCallable,Category="Studio Device Builder") static bool PrepareFontPages(UFont* Font);
 UFUNCTION(BlueprintCallable,Category="Studio Device Builder") static AActor* SpawnDeviceActor(TSubclassOf<AActor> ActorClass, FVector Location, FRotator Rotation);
 UFUNCTION(BlueprintCallable,Category="Studio Device Builder") static FString RunLayerSmokeTest(TSubclassOf<AActor> ActorClass);
 UFUNCTION(BlueprintCallable,Category="Studio Device Builder") static bool CaptureDevicePreview();
 UFUNCTION(BlueprintCallable,Category="Studio Device Builder") static bool CaptureRuntimePreview(float Seconds, bool PressKey, float KeyX, float KeyY, int32 PressCount = 1);
 UFUNCTION(BlueprintCallable,Category="Studio Device Builder") static bool ValidateDeviceMaterials(const TArray<UMaterialInterface*>& Materials);
 UFUNCTION(BlueprintCallable,Category="Studio Device Builder") static UBlueprint* CreateCompositorBlueprint(const TArray<UMaterialInterface*>& Materials, UMaterialInterface* DisplayMaterial);
 UFUNCTION(BlueprintCallable,Category="Studio Device Builder") static UBlueprint* CreateInputBlueprint(UMaterialParameterCollection* Collection, bool Diagnostics = false);
 UFUNCTION(BlueprintCallable,Category="Studio Device Builder") static UBlueprint* CreateLayerBlueprint(UMaterialParameterCollection* Collection, UMaterialInterface* Material, const FString& LayerJson, const FString& RulesJson, const FString& AssetName);
};
