// Included after StudioLayerBuilder's graph helpers. These functions generate
// ordinary Engine Blueprint nodes; they are not a shipped runtime dependency.
namespace StudioLayerBuilder {
void PrismVariables(Graph&,const TSharedPtr<FJsonObject>&,const FEdGraphPinType&);
void PrismInput(Graph&,const TSharedPtr<FJsonObject>&,V,V,V,UEdGraphPin*);
void PrismTick(Graph&,UMaterialParameterCollection*,V,UEdGraphPin*);
bool NativeGame(const TSharedPtr<FJsonObject>& Layer){const FString Kind=Str(Layer,TEXT("text"));return Str(Layer,TEXT("type"))==TEXT("collection")&&(Kind==TEXT("cloud-courier")||Kind==TEXT("dune-runner")||Kind==TEXT("prism-breaker"));}
bool CloudGame(const TSharedPtr<FJsonObject>& Layer){return Str(Layer,TEXT("text"))==TEXT("cloud-courier");}
V GameAnd(Graph& B,V A,V C){return B.Math(TEXT("BooleanAND"),A,C);}
V GameOr(Graph& B,V A,V C){return B.Math(TEXT("BooleanOR"),A,C);}
V GameLess(Graph& B,V A,V C){return B.Math(TEXT("Less_FloatFloat"),A,C);}
V GameGreater(Graph& B,V A,V C){return B.Math(TEXT("Greater_FloatFloat"),A,C);}
void GameVariables(Graph& B,const TSharedPtr<FJsonObject>& Layer,const FEdGraphPinType& Float){
 if(Str(Layer,TEXT("text"))==TEXT("prism-breaker")){PrismVariables(B,Layer,Float);return;}
 for(const TCHAR* Name:{TEXT("GPhase"),TEXT("GScore"),TEXT("GBest"),TEXT("GDistance"),TEXT("GVy"),TEXT("GPreviousX")})B.Variable(Name,Float,TEXT("0"));
 B.Variable(TEXT("GY"),Float,CloudGame(Layer)?TEXT("275"):TEXT("420"));
 B.Variable(TEXT("GCloud"),Float,CloudGame(Layer)?TEXT("1"):TEXT("0"));
 const TSharedPtr<FJsonObject>* Keys=nullptr;if(Layer->TryGetObjectField(TEXT("nativeGameKeys"),Keys))for(const auto& Pair:TArray<TPair<FString,FString>>{TPair<FString,FString>(TEXT("action"),TEXT("GAction")),TPair<FString,FString>(TEXT("restart"),TEXT("GRestart"))}){const TArray<TSharedPtr<FJsonValue>>* Rects=nullptr;if((*Keys)->TryGetArrayField(Pair.Key,Rects)&&Rects->Num()){auto Rect=(*Rects)[0]->AsObject();B.Variable(*(Pair.Value+TEXT("X")),Float,FString::SanitizeFloat(Num(Rect,TEXT("x"),0)+Num(Rect,TEXT("width"),0)*.5f));B.Variable(*(Pair.Value+TEXT("Y")),Float,FString::SanitizeFloat(Num(Rect,TEXT("y"),0)+Num(Rect,TEXT("height"),0)*.5f));}}
 for(int32 I=0;I<6;I++){B.Variable(*FString::Printf(TEXT("GOX%d"),I),Float,FString::SanitizeFloat(1980.f+I*(CloudGame(Layer)?689.f:1100.f)));B.Variable(*FString::Printf(TEXT("GOY%d"),I),Float,FString::SanitizeFloat(110.f+Rand(uint32(Num(Layer,TEXT("seed"),712)),I)*285.f));}
}
UEdGraphPin* ResetGame(Graph& B,const TSharedPtr<FJsonObject>& Layer,UEdGraphPin* Exec){
 Exec=B.Set(TEXT("GBest"),B.Math(TEXT("FMax"),B.Get(TEXT("GBest")),B.Get(TEXT("GScore"))),Exec);
 for(const TCHAR* Name:{TEXT("GPhase"),TEXT("GScore"),TEXT("GDistance"),TEXT("GVy")})Exec=B.Set(Name,0.f,Exec);
 Exec=B.Set(TEXT("GY"),CloudGame(Layer)?275.f:420.f,Exec);
 for(int32 I=0;I<6;I++)Exec=B.Set(*FString::Printf(TEXT("GOX%d"),I),1980.f+I*(CloudGame(Layer)?689.f:1100.f),Exec);
 return Exec;
}
V GameKeyMatch(Graph& B,const TSharedPtr<FJsonObject>& Layer,const TCHAR* Group,V X,V Y){
 V Match(FString(TEXT("False")));const TSharedPtr<FJsonObject>* Map=nullptr;const TArray<TSharedPtr<FJsonValue>>* Rects=nullptr;
 if(!Layer->TryGetObjectField(TEXT("nativeGameKeys"),Map)||!(*Map)->TryGetArrayField(Group,Rects))return Match;
 for(const auto& Value:*Rects){auto R=Value->AsObject();float RX=Num(R,TEXT("x"),0),RY=Num(R,TEXT("y"),0);V InX=GameAnd(B,B.Math(TEXT("GreaterEqual_FloatFloat"),X,RX),GameLess(B,X,RX+Num(R,TEXT("width"),0))),InY=GameAnd(B,B.Math(TEXT("GreaterEqual_FloatFloat"),Y,RY),GameLess(B,Y,RY+Num(R,TEXT("height"),0)));Match=GameOr(B,Match,GameAnd(B,InX,InY));}
 return Match;
}
void GameInput(Graph& B,const TSharedPtr<FJsonObject>& Layer,V Actuated,V X,V Y,UEdGraphPin* Exec){
 if(Str(Layer,TEXT("text"))==TEXT("prism-breaker")){PrismInput(B,Layer,Actuated,X,Y,Exec);return;}
 auto* Press=B.Branch(Actuated,Exec);auto* Restart=B.Branch(GameKeyMatch(B,Layer,TEXT("restart"),X,Y),B.Pin(Press,TEXT("then")));
 UEdGraphPin* Reset=ResetGame(B,Layer,B.Pin(Restart,TEXT("then")));Reset=B.Set(TEXT("GPhase"),1.f,Reset);B.Set(TEXT("GVy"),CloudGame(Layer)?-265.f:-670.f,Reset);
 auto* Action=B.Branch(GameKeyMatch(B,Layer,TEXT("action"),X,Y),B.Pin(Restart,TEXT("else")));
 auto* Dead=B.Branch(GameGreater(B,B.Get(TEXT("GPhase")),1.5f),B.Pin(Action,TEXT("then")));
 UEdGraphPin* Again=ResetGame(B,Layer,B.Pin(Dead,TEXT("then")));Again=B.Set(TEXT("GPhase"),1.f,Again);B.Set(TEXT("GVy"),CloudGame(Layer)?-265.f:-670.f,Again);
 UEdGraphPin* Active=B.Set(TEXT("GPhase"),1.f,B.Pin(Dead,TEXT("else")));
 if(!CloudGame(Layer)){auto* Ground=B.Branch(B.Math(TEXT("GreaterEqual_FloatFloat"),B.Get(TEXT("GY")),419.f),Active);Active=B.Pin(Ground,TEXT("then"));}
 B.Set(TEXT("GVy"),CloudGame(Layer)?-265.f:-670.f,Active);
}
void GameTick(Graph& B,const TSharedPtr<FJsonObject>& Layer,UMaterialParameterCollection* Collection,V Delta,UEdGraphPin* Exec){
 if(Str(Layer,TEXT("text"))==TEXT("prism-breaker")){PrismTick(B,Collection,Delta,Exec);return;}
 const bool Cloud=CloudGame(Layer);V DT=B.Clamp(Delta,0.f,.05f);auto* Sequence=B.Node<UK2Node_ExecutionSequence>();Sequence->AllocateDefaultPins();B.Connect(Exec,B.Pin(Sequence,TEXT("execute")));
 auto* Playing=B.Branch(GameAnd(B,GameGreater(B,B.Get(TEXT("GPhase")),.5f),GameLess(B,B.Get(TEXT("GPhase")),1.5f)),Sequence->GetThenPinGivenIndex(0));Exec=B.Pin(Playing,TEXT("then"));
 Exec=B.Set(TEXT("GDistance"),Add(B,B.Get(TEXT("GDistance")),DT),Exec);Exec=B.Set(TEXT("GVy"),Add(B,B.Get(TEXT("GVy")),Mul(B,Cloud?610.f:1700.f,DT)),Exec);Exec=B.Set(TEXT("GY"),Add(B,B.Get(TEXT("GY")),Mul(B,B.Get(TEXT("GVy")),DT)),Exec);
 if(!Cloud){Exec=B.Set(TEXT("GY"),B.Math(TEXT("FMin"),B.Get(TEXT("GY")),420.f),Exec);}
 V Speed=Cloud?V(265.f):Add(B,440.f,B.Math(TEXT("FMin"),260.f,Mul(B,B.Get(TEXT("GDistance")),4.f)));
 auto* Steps=B.Node<UK2Node_ExecutionSequence>();Steps->AllocateDefaultPins();while(Steps->Pins.Num()-1<8)Steps->AddInputPin();B.Connect(Exec,B.Pin(Steps,TEXT("execute")));
 for(int32 I=0;I<6;I++){
  FString NX=FString::Printf(TEXT("GOX%d"),I),NY=FString::Printf(TEXT("GOY%d"),I);UEdGraphPin* E=B.Set(TEXT("GPreviousX"),B.Get(*NX),Steps->GetThenPinGivenIndex(I));E=B.Set(*NX,Sub(B,B.Get(*NX),Mul(B,Speed,DT)),E);
  auto* Actions=B.Node<UK2Node_ExecutionSequence>();Actions->AllocateDefaultPins();Actions->AddInputPin();B.Connect(E,B.Pin(Actions,TEXT("execute")));
  const float Width=Cloud?95.f:30.f+Rand(uint32(Num(Layer,TEXT("seed"),712)),I+3)*35.f,Height=40.f+Rand(uint32(Num(Layer,TEXT("seed"),712)),I+9)*43.f;
  auto* Passed=B.Branch(GameAnd(B,GameLess(B,Add(B,B.Get(*NX),Width),Cloud?379.f:380.f),B.Math(TEXT("GreaterEqual_FloatFloat"),Add(B,B.Get(TEXT("GPreviousX")),Width),Cloud?379.f:380.f)),Actions->GetThenPinGivenIndex(0));B.Set(TEXT("GScore"),Add(B,B.Get(TEXT("GScore")),Cloud?1.f:10.f),B.Pin(Passed,TEXT("then")));
  V Across=GameAnd(B,GameGreater(B,Cloud?423.f:422.f,B.Get(*NX)),GameLess(B,Cloud?377.f:378.f,Add(B,B.Get(*NX),Width)));
  V Vertical=Cloud?GameOr(B,GameLess(B,Sub(B,B.Get(TEXT("GY")),17.f),Sub(B,B.Get(*NY),93.f)),GameGreater(B,Add(B,B.Get(TEXT("GY")),17.f),Add(B,B.Get(*NY),93.f))):GameAnd(B,GameGreater(B,Add(B,B.Get(TEXT("GY")),25.f),445.f-Height),GameLess(B,Sub(B,B.Get(TEXT("GY")),25.f),445.f));
  auto* Hit=B.Branch(GameAnd(B,Across,Vertical),Actions->GetThenPinGivenIndex(1));B.Set(TEXT("GPhase"),2.f,B.Pin(Hit,TEXT("then")));
  auto* Recycle=B.Branch(GameLess(B,B.Get(*NX),-120.f),Actions->GetThenPinGivenIndex(2));B.Set(*NX,Add(B,B.Get(*NX),6.f*(Cloud?689.f:1100.f)),B.Pin(Recycle,TEXT("then")));
 }
 if(Cloud){auto* Outside=B.Branch(GameOr(B,GameLess(B,B.Get(TEXT("GY")),30.f),GameGreater(B,B.Get(TEXT("GY")),518.f)),Steps->GetThenPinGivenIndex(6));B.Set(TEXT("GPhase"),2.f,B.Pin(Outside,TEXT("then")));}
 else{auto* Ground=B.Branch(B.Math(TEXT("GreaterEqual_FloatFloat"),B.Get(TEXT("GY")),420.f),Steps->GetThenPinGivenIndex(6));B.Set(TEXT("GVy"),0.f,B.Pin(Ground,TEXT("then")));}
 Exec=Sequence->GetThenPinGivenIndex(1);
 auto Publish=[&](const TCHAR* Name,V R,V G,V Blue,V A){auto* Color=B.Call(UKismetMathLibrary::StaticClass(),TEXT("MakeColor"));B.Input(Color,TEXT("R"),R);B.Input(Color,TEXT("G"),G);B.Input(Color,TEXT("B"),Blue);B.Input(Color,TEXT("A"),A);auto* Set=B.Call(UKismetMaterialLibrary::StaticClass(),TEXT("SetVectorParameterValue"));B.Pin(Set,TEXT("Collection"))->DefaultObject=Collection;B.Input(Set,TEXT("ParameterName"),FString(Name));B.Input(Set,TEXT("ParameterValue"),B.Pin(Color,TEXT("ReturnValue")));B.Connect(Exec,B.Pin(Set,TEXT("execute")));Exec=B.Pin(Set,TEXT("then"));};
 Publish(TEXT("GameState"),B.Get(TEXT("GPhase")),B.Get(TEXT("GScore")),B.Get(TEXT("GY")),B.Get(TEXT("GVy")));
 Publish(TEXT("GameObstaclesA"),B.Get(TEXT("GOX0")),B.Get(TEXT("GOX1")),B.Get(TEXT("GOX2")),B.Get(TEXT("GOX3")));
 Publish(TEXT("GameObstaclesB"),B.Get(TEXT("GOX4")),B.Get(TEXT("GOX5")),0.f,0.f);
}
}
