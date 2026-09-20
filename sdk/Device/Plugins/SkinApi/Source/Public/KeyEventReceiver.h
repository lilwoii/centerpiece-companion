#pragma once
#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "KeyEventReceiver.generated.h"
// Reflected signatures documented by nun's MIT cproskin SDK (nun.tax).
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FSkinKeyEvent,uint8,HCode,bool,IsActuated,int32,Percentage);
UCLASS(BlueprintType)
class SKINAPI_API UKeyEventReceiver:public UObject { GENERATED_BODY() public: UPROPERTY(BlueprintAssignable,Category="SkinApi") FSkinKeyEvent OnKeyEvent; };
