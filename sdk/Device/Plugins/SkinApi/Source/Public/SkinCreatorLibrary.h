#pragma once
#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "KeyEventReceiver.h"
#include "SkinCreatorLibrary.generated.h"
UCLASS()
class SKINAPI_API USkinCreatorLibrary:public UBlueprintFunctionLibrary
{
 GENERATED_BODY()
 public:
 UFUNCTION(BlueprintPure,Category="SkinApi") static UKeyEventReceiver* GetKeyEventReceiver();
 UFUNCTION(BlueprintCallable,Category="SkinApi") static void SetKeyEventReceiver(UKeyEventReceiver* Receiver);
 UFUNCTION(BlueprintPure,Category="SkinApi") static FVector2D GetPositionByKeyIndex(uint8 KeyIndex);
 // Local stub control only: deliberately not reflected into any Blueprint.
 static void SetPreviewPositionForTests(FVector2D Position);
 static void SetPreviewReceiverAvailableForTests(bool Available);
};
