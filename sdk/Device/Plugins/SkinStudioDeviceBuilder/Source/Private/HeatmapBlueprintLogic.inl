// Accumulated per-cell heat. Only the four neighboring cells are touched per
// physical key-down; fading runs in the material without per-frame USB or BP work.
namespace StudioLayerBuilder {
static void HeatmapInput(Graph& B,const TSharedPtr<FJsonObject>& Layer,UMaterialParameterCollection* Collection,V Actuated,V WorldKey,UEdGraphPin* Start)
{
 auto* Press=B.Branch(Actuated,Start);UEdGraphPin* Exec=B.Pin(Press,TEXT("then"));
 auto* Transform=B.Call(AActor::StaticClass(),TEXT("GetTransform"));if(auto* Execute=Transform->FindPin(TEXT("execute"))){B.Connect(Exec,Execute);Exec=B.Pin(Transform,TEXT("then"));}
 auto* Local=B.Call(UKismetMathLibrary::StaticClass(),TEXT("InverseTransformLocation"));B.Input(Local,TEXT("T"),B.Pin(Transform,TEXT("ReturnValue")));B.Input(Local,TEXT("Location"),WorldKey);
 auto* Parts=B.Call(UKismetMathLibrary::StaticClass(),TEXT("BreakVector"));B.Input(Parts,TEXT("InVec"),B.Pin(Local,TEXT("ReturnValue")));
 V X=Add(B,Mul(B,Div(B,B.Pin(Parts,TEXT("X")),Num(Layer,TEXT("width"),1920)),16.f),8.f),Y=Add(B,Mul(B,Div(B,B.Pin(Parts,TEXT("Y")),Num(Layer,TEXT("height"),550)),5.f),2.5f);
 V BaseX=B.Unary(TEXT("FFloor"),Sub(B,X,.5f)),BaseY=B.Unary(TEXT("FFloor"),Sub(B,Y,.5f));
 auto* Sequence=B.Node<UK2Node_ExecutionSequence>();Sequence->AllocateDefaultPins();Sequence->AddInputPin();Sequence->AddInputPin();B.Connect(Exec,B.Pin(Sequence,TEXT("execute")));
 for(int32 N=0;N<4;N++){
  V CX=Add(B,BaseX,float(N%2)),CY=Add(B,BaseY,float(N/2));
  V InX=B.Math(TEXT("BooleanAND"),B.Math(TEXT("GreaterEqual_FloatFloat"),CX,0.f),B.Math(TEXT("Less_FloatFloat"),CX,16.f));
  V InY=B.Math(TEXT("BooleanAND"),B.Math(TEXT("GreaterEqual_FloatFloat"),CY,0.f),B.Math(TEXT("Less_FloatFloat"),CY,5.f));
  V DX=Sub(B,X,Add(B,CX,.5f)),DY=Sub(B,Y,Add(B,CY,.5f));V Weight=B.Clamp(Sub(B,1.f,B.Unary(TEXT("Sqrt"),Add(B,Mul(B,DX,DX),Mul(B,DY,DY)))));
  auto* Near=B.Branch(B.Math(TEXT("BooleanAND"),B.Math(TEXT("BooleanAND"),InX,InY),B.Math(TEXT("Greater_FloatFloat"),Weight,0.f)),Sequence->GetThenPinGivenIndex(N));auto* CellExec=B.Pin(Near,TEXT("then"));
  auto* CellString=B.Call(UKismetStringLibrary::StaticClass(),TEXT("Conv_IntToString"));B.Input(CellString,TEXT("InInt"),B.Unary(TEXT("FTrunc"),Add(B,Mul(B,CY,16.f),CX)));
  auto Name=[&](const TCHAR* Prefix){auto* Join=B.Call(UKismetStringLibrary::StaticClass(),TEXT("Concat_StrStr"));B.Input(Join,TEXT("A"),FString(Prefix));B.Input(Join,TEXT("B"),B.Pin(CellString,TEXT("ReturnValue")));auto* Convert=B.Call(UKismetStringLibrary::StaticClass(),TEXT("Conv_StringToName"));B.Input(Convert,TEXT("InString"),B.Pin(Join,TEXT("ReturnValue")));return V(B.Pin(Convert,TEXT("ReturnValue")));};
  auto Read=[&](V Parameter){auto* Get=B.Call(UKismetMaterialLibrary::StaticClass(),TEXT("GetScalarParameterValue"));B.Pin(Get,TEXT("Collection"))->DefaultObject=Collection;B.Input(Get,TEXT("ParameterName"),Parameter);B.Connect(CellExec,B.Pin(Get,TEXT("execute")));CellExec=B.Pin(Get,TEXT("then"));return V(B.Pin(Get,TEXT("ReturnValue")));};
  V HeatName=Name(TEXT("Heat")),TimeName=Name(TEXT("HeatTime")),OldHeat=Read(HeatName),OldTime=Read(TimeName);
  V Decay=B.Unary(TEXT("Exp"),Mul(B,B.Clamp(Sub(B,B.Time(),OldTime),0.f,1000.f),-.65f));
  V Heat=B.Clamp(Add(B,Mul(B,OldHeat,Decay),Mul(B,Weight,Num(Layer,TEXT("reactivity"),1))),0.f,64.f);
  CellExec=B.NamedParameter(Collection,HeatName,Heat,CellExec);B.NamedParameter(Collection,TimeName,B.Time(),CellExec);
 }
}
}
