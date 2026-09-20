#include "SkinCreatorLibrary.h"
#include "Modules/ModuleManager.h"
IMPLEMENT_MODULE(FDefaultModuleImpl,SkinApi)
static UKeyEventReceiver* PreviewReceiver=nullptr;
static FVector2D PreviewPosition=FVector2D::ZeroVector;
static bool PreviewReceiverAvailable=true;
UKeyEventReceiver* USkinCreatorLibrary::GetKeyEventReceiver(){if(!PreviewReceiverAvailable)return nullptr;if(!PreviewReceiver){PreviewReceiver=NewObject<UKeyEventReceiver>();PreviewReceiver->AddToRoot();}return PreviewReceiver;}
void USkinCreatorLibrary::SetKeyEventReceiver(UKeyEventReceiver* Receiver){if(PreviewReceiver==Receiver)return;if(PreviewReceiver)PreviewReceiver->RemoveFromRoot();PreviewReceiver=Receiver;if(PreviewReceiver)PreviewReceiver->AddToRoot();}
FVector2D USkinCreatorLibrary::GetPositionByKeyIndex(uint8 KeyIndex){return PreviewPosition;}
void USkinCreatorLibrary::SetPreviewPositionForTests(FVector2D Position){PreviewPosition=Position;}
void USkinCreatorLibrary::SetPreviewReceiverAvailableForTests(bool Available){PreviewReceiverAvailable=Available;}
