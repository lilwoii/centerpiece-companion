#include "SkinStudioCollectionScene.h"
#include "SkinStudioRuntime.h"
#include "Camera/CameraComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SceneComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/PointLightComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "Engine/World.h"

ASkinStudioCollectionScene::ASkinStudioCollectionScene()
{
    PrimaryActorTick.bCanEverTick = true;
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
    Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("PreviewCamera")); Camera->SetupAttachment(RootComponent);
    Camera->SetRelativeLocation(FVector(0,-2000,750)); Camera->SetRelativeRotation(FRotator(-14,90,0));
    Camera->ProjectionMode=ECameraProjectionMode::Perspective; Camera->FieldOfView=51; Camera->AspectRatio=1920.f/550.f; Camera->bConstrainAspectRatio=true;
    auto* Sun=CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Sun")); Sun->SetupAttachment(RootComponent); Sun->SetRelativeRotation(FRotator(-38,-32,0)); Sun->Intensity=4;
    auto* Fill=CreateDefaultSubobject<UPointLightComponent>(TEXT("Fill")); Fill->SetupAttachment(RootComponent); Fill->SetRelativeLocation(FVector(0,-700,650)); Fill->Intensity=16000; Fill->AttenuationRadius=3000; Fill->SetLightColor(FLinearColor(.52f,.70f,1));
}
UStaticMeshComponent* ASkinStudioCollectionScene::Part(const TCHAR* Shape,FVector Position,FVector Scale,FLinearColor Color,const TCHAR* Motion,FRotator Rotation)
{
    if(Parts.Num()>=256)return nullptr;
    // Fixed engine-owned primitive inventory; a source scene cannot supply an asset path.
    FString Asset=FString::Printf(TEXT("/Engine/BasicShapes/%s.%s"),Shape,Shape);
    auto* Mesh=LoadObject<UStaticMesh>(nullptr,*Asset); if(!Mesh)return nullptr;
    auto* Component=NewObject<UStaticMeshComponent>(this); Component->SetStaticMesh(Mesh); Component->SetMobility(EComponentMobility::Movable);
    Component->SetCollisionEnabled(ECollisionEnabled::NoCollision); Component->SetupAttachment(RootComponent);
    Component->SetRelativeLocation(Position); Component->SetRelativeScale3D(Scale); Component->SetRelativeRotation(Rotation); Component->RegisterComponent();
    if(auto* Base=LoadObject<UMaterialInterface>(nullptr,TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial")))
    { auto* Material=UMaterialInstanceDynamic::Create(Base,this); Material->SetVectorParameterValue(TEXT("Color"),Color); Component->SetMaterial(0,Material); }
    Parts.Add(Component); Homes.Add(Position); Motions.Add(Motion); return Component;
}
bool ASkinStudioCollectionScene::Configure(const FStudioLayerFrame& Layer,USkinStudioRuntime* InRuntime)
{
    const TSet<FString> Ids={TEXT("lantern-festival"),TEXT("paper-ocean"),TEXT("neon-speedway"),TEXT("clockwork-garden"),TEXT("prism-bloom"),TEXT("tidal-observatory"),TEXT("alpine-reflection"),TEXT("storm-window"),TEXT("ember-forge"),TEXT("moon-tranquility"),TEXT("atlas-launch")};
    if(!Ids.Contains(Layer.Text)||!InRuntime)return false;
    for(auto* Component:Parts)if(Component)Component->DestroyComponent(); Parts.Reset(); Homes.Reset(); Motions.Reset();
    Runtime=InRuntime; LayerId=Layer.Id; SceneId=Layer.Text; ConstructScene(); return true;
}
void ASkinStudioCollectionScene::Landscape(const FString& Kind)
{
    FRandomStream Random(6042);
    const bool Moon=Kind==TEXT("moon"), Alpine=Kind==TEXT("alpine");
    for(int32 I=0;I<24;++I)
    {
        const float X=-1080+I*94, Height=Alpine?110+Random.FRand()*260:20+Random.FRand()*80;
        const FLinearColor Stone=Moon?FLinearColor(.38f,.39f,.42f):Alpine?FLinearColor(.23f,.29f,.35f):FLinearColor(.24f,.21f,.18f);
        Part(Alpine?TEXT("Cone"):TEXT("Sphere"),FVector(X,Alpine?330:80,Height*.4f),FVector(Alpine?3:1.4f,Alpine?3:1.2f,Height/100),Stone,TEXT(""),FRotator(0,Random.FRand()*60,0));
        if(Alpine)Part(TEXT("Cone"),FVector(X,330,Height*.83f),FVector(.9f,.9f,Height/260),FLinearColor(.88f,.94f,1));
    }
}
void ASkinStudioCollectionScene::ConstructScene()
{
    const FLinearColor Gold(.85f,.40f,.05f),Teal(.04f,.48f,.53f),White(.8f,.85f,.9f),Dark(.035f,.045f,.065f);
    Part(TEXT("Cube"),FVector(0,180,-30),FVector(24,12,.3f),Dark);
    FRandomStream Random(9204);
    if(SceneId==TEXT("atlas-launch"))
    {
        // Two-stage launch vehicle, service tower, tanks and individually animated plume.
        Part(TEXT("Cylinder"),FVector(80,0,170),FVector(.66f,.66f,2.8f),White,TEXT("launch"));
        Part(TEXT("Cylinder"),FVector(80,0,335),FVector(.66f,.66f,.5f),White,TEXT("launch"));
        Part(TEXT("Cone"),FVector(80,0,390),FVector(.66f,.66f,.66f),White,TEXT("launch"));
        Part(TEXT("Cylinder"),FVector(80,0,290),FVector(.68f,.68f,.12f),Dark,TEXT("launch"));
        for(int32 I=0;I<4;++I)Part(TEXT("Cube"),FVector(80+(I%2?36:-36),I<2?-14:14,55),FVector(.08f,.40f,.7f),White,TEXT("launch"),FRotator(0,I*90,15));
        for(int32 I=0;I<8;++I){Part(TEXT("Cube"),FVector(-105,35,35+I*48),FVector(.15f,.20f,.52f),Dark);Part(TEXT("Cube"),FVector(-210,35,35+I*48),FVector(.15f,.20f,.52f),Dark);Part(TEXT("Cube"),FVector(-155,35,35+I*48),FVector(1.2f,.10f,.10f),White);}
        for(int32 I=0;I<3;++I)Part(TEXT("Cylinder"),FVector(450+I*100,130,68),FVector(.7f,.7f,1.3f),White);
        for(int32 I=0;I<28;++I)Part(TEXT("Sphere"),FVector(80+(Random.FRand()-.5f)*260,-25+(Random.FRand()-.5f)*140,10),FVector(.65f,.65f,.5f),White,TEXT("smoke"));
        Part(TEXT("Cone"),FVector(80,0,0),FVector(.4f,.4f,1.5f),FLinearColor(1,.26f,.015f),TEXT("flame"),FRotator(180,0,0));
    }
    else if(SceneId==TEXT("lantern-festival"))
    {
        Part(TEXT("Cube"),FVector(0,310,80),FVector(4,1.5f,1.6f),FLinearColor(.13f,.06f,.045f));
        Part(TEXT("Cone"),FVector(0,310,210),FVector(5.7f,3,.7f),Dark,TEXT(""),FRotator(0,45,0));
        for(int32 I=0;I<28;++I){const FVector P(-860+Random.FRand()*1720,-60+Random.FRand()*220,65+Random.FRand()*350);Part(TEXT("Cylinder"),P,FVector(.35f,.35f,.55f),I%2?Gold:FLinearColor(.7f,.045f,.025f),TEXT("float"));Part(TEXT("Sphere"),P-FVector(0,0,34),FVector(.08f),Gold,TEXT("float"));}
    }
    else if(SceneId==TEXT("paper-ocean"))
    {
        for(int32 I=0;I<18;++I)Part(TEXT("Cone"),FVector(-1000+I*120,-70,35),FVector(1.8f,3,.75f),Teal,TEXT("wave"),FRotator(0,45,0));
        Part(TEXT("Sphere"),FVector(0,-30,120),FVector(4.4f,1.2f,1.8f),FLinearColor(.43f,.63f,.85f),TEXT("whale"));
        Part(TEXT("Cone"),FVector(-270,-30,140),FVector(1.7f,.18f,1.1f),White,TEXT("whale"),FRotator(0,0,90));
        Part(TEXT("Cone"),FVector(30,-50,220),FVector(1.6f,.12f,.6f),White,TEXT("whale"));
    }
    else if(SceneId==TEXT("neon-speedway"))
    {
        Part(TEXT("Cube"),FVector(0,120,-2),FVector(4.4f,30,.1f),Dark);
        for(int32 I=0;I<18;++I){Part(TEXT("Cube"),FVector(I%2?240:-240,-500+I*85,1),FVector(.08f,.6f,.08f),I%2?Teal:FLinearColor(.75f,.02f,.42f),TEXT("road"));Part(TEXT("Cube"),FVector((I%2?1:-1)*(400+Random.FRand()*430),I*70-300,110),FVector(1.1f,1.2f,2+Random.FRand()*2),FLinearColor(.08f,.06f,.21f));}
        Part(TEXT("Cube"),FVector(0,-250,25),FVector(1.1f,2.3f,.35f),FLinearColor(.7f,.03f,.1f));
    }
    else if(SceneId==TEXT("clockwork-garden"))
    {
        for(int32 I=0;I<9;++I){const FVector C(-760+I*190,60+(I%2)*60,90);Part(TEXT("Cylinder"),C,FVector(1.5f,1.5f,.22f),Gold,TEXT("gear"),FRotator(90,0,0));for(int32 J=0;J<12;++J){const float A=J*PI/6;Part(TEXT("Cube"),C+FVector(FMath::Cos(A)*78,0,FMath::Sin(A)*78),FVector(.25f,.24f,.25f),Gold,TEXT("gear"));}Part(TEXT("Cylinder"),C,FVector(.35f,.35f,.25f),Dark,TEXT(""),FRotator(90,0,0));}
    }
    else if(SceneId==TEXT("prism-bloom"))
    {
        for(int32 I=0;I<55;++I){float H=70+Random.FRand()*280;Part(TEXT("Cone"),FVector(-900+Random.FRand()*1800,-60+Random.FRand()*190,H/2),FVector(.4f+Random.FRand()*.8f,.6f,H/100),I%3?Teal:FLinearColor(.5f,.14f,.65f),TEXT("crystal"),FRotator(0,Random.FRand()*180,Random.FRand()*12-6));}
    }
    else if(SceneId==TEXT("tidal-observatory")||SceneId==TEXT("alpine-reflection"))
    {
        const bool Alpine=SceneId==TEXT("alpine-reflection");Landscape(Alpine?TEXT("alpine"):TEXT("shore"));
        for(int32 I=0;I<26;++I)Part(TEXT("Cube"),FVector(0,-280+I*20,5),FVector(22,.15f,.025f),Alpine?FLinearColor(.15f,.36f,.43f):Teal,TEXT("wave"));
        if(!Alpine){Part(TEXT("Cylinder"),FVector(650,250,100),FVector(1,1,2),White);Part(TEXT("Sphere"),FVector(650,250,220),FVector(1.3f,1.3f,.8f),White);}
    }
    else if(SceneId==TEXT("storm-window"))
    {
        for(int32 I=0;I<18;++I)Part(TEXT("Cube"),FVector(-960+I*110,250,85+Random.FRand()*80),FVector(.9f,1,1.8f+Random.FRand()),Dark);
        for(int32 I=0;I<90;++I)Part(TEXT("Sphere"),FVector(-920+Random.FRand()*1840,210,Random.FRand()*340),FVector(.05f),I%3?Gold:Teal);
        for(int32 I=0;I<55;++I)Part(TEXT("Sphere"),FVector(-920+Random.FRand()*1840,-300,Random.FRand()*420),FVector(.025f,.025f,.20f),White,TEXT("rain"));
        for(int32 I=0;I<3;++I)Part(TEXT("Cube"),FVector(-920+I*920,-320,200),FVector(.16f,.18f,4.8f),Dark);
    }
    else if(SceneId==TEXT("ember-forge"))
    {
        Part(TEXT("Cube"),FVector(0,-100,80),FVector(3.5f,2,1.5f),Dark);Part(TEXT("Cube"),FVector(0,-100,175),FVector(5.5f,2.3f,.45f),White);Part(TEXT("Cone"),FVector(340,-100,175),FVector(1.8f,1.4f,2),White,TEXT(""),FRotator(0,0,-90));
        for(int32 I=0;I<42;++I)Part(TEXT("Sphere"),FVector(-850+Random.FRand()*500,90,Random.FRand()*80),FVector(.25f),FLinearColor(.8f,.16f,.01f),TEXT("ember"));
        for(int32 I=0;I<28;++I)Part(TEXT("Sphere"),FVector(0,-100,205),FVector(.025f),Gold,TEXT("spark"));
    }
    else if(SceneId==TEXT("moon-tranquility"))
    {
        Landscape(TEXT("moon"));Part(TEXT("Sphere"),FVector(570,550,350),FVector(1.6f),FLinearColor(.09f,.26f,.62f));
        Part(TEXT("Cylinder"),FVector(-210,-80,80),FVector(.7f,.7f,1.3f),White);Part(TEXT("Sphere"),FVector(-210,-80,175),FVector(.8f),White);
        Part(TEXT("Cube"),FVector(-210,-112,175),FVector(.48f,.12f,.40f),Gold);
        for(int32 I=0;I<18;++I)Part(TEXT("Sphere"),FVector(-210,-80,5),FVector(.035f),White,TEXT("dust"));
    }
}
void ASkinStudioCollectionScene::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);if(!Runtime)return;AnimationTime+=FMath::Clamp(DeltaSeconds,0.f,.1f);
    const float Time=Runtime->GetElapsedSeconds();for(const auto& Event:Runtime->GetActiveEffects())if((Event.Target==LayerId||Event.Target==TEXT("all"))&&(SceneId!=TEXT("atlas-launch")||Event.Effect==TEXT("launch"))&&Event.StartedAt>LastTriggerAt)LastTriggerAt=Event.StartedAt;
    const float Age=Time-LastTriggerAt,Reaction=Age>=0&&Age<3?FMath::Sin(Age*PI/3)*(1-Age/3):0;
    for(int32 I=0;I<Parts.Num();++I)
    {
        auto* Component=Parts[I];if(!Component)continue;FVector Position=Homes[I];const FString& Motion=Motions[I];
        if(Motion==TEXT("float")){Position.Z+=FMath::Sin(AnimationTime*.5f+I)*18+Reaction*90;Position.X+=FMath::Sin(AnimationTime*.3f+I)*16;}
        else if(Motion==TEXT("wave"))Position.Z+=FMath::Sin(AnimationTime*1.4f+I*.45f)*(3+Reaction*14);
        else if(Motion==TEXT("whale")){Position.Z+=FMath::Sin(AnimationTime*.8f)*22+Reaction*70;Position.X+=FMath::Sin(AnimationTime*.18f)*120;}
        else if(Motion==TEXT("road"))Position.Y=FMath::Fmod(Homes[I].Y+AnimationTime*(120+Reaction*300)+2000,1700)-600;
        else if(Motion==TEXT("gear"))Component->AddLocalRotation(FRotator(0,DeltaSeconds*(12+Reaction*120),0));
        else if(Motion==TEXT("crystal")){Position.Z+=FMath::Sin(AnimationTime*.7f+I)*6+Reaction*35;}
        else if(Motion==TEXT("rain")){Position.Z=440-FMath::Fmod(AnimationTime*100+I*37,440);Position.X+=Reaction*90;}
        else if(Motion==TEXT("ember"))Position.Z+=FMath::Sin(AnimationTime*3+I)*10;
        else if(Motion==TEXT("spark")||Motion==TEXT("dust")){const bool Active=Age>=0&&Age<2;Component->SetVisibility(Active);const float A=I*2.399f;Position+=FVector(FMath::Cos(A)*Age*150,FMath::Sin(A)*Age*80,Age*190-Age*Age*85);}
        else if(Motion==TEXT("launch")){Position.Z+=Age>1&&Age<7?FMath::Pow((Age-1)/6,2)*1500:0;Component->SetVisibility(Age<7||Age>9);}
        else if(Motion==TEXT("smoke")){const bool Active=Age>=0&&Age<7;Component->SetVisibility(Active);const float Spread=FMath::Clamp(Age/3,0.f,2.f);Position.X+=(I%2?1:-1)*Spread*250;Position.Z+=Spread*25;Component->SetRelativeScale3D(FVector(.65f+Spread*.8f));}
        else if(Motion==TEXT("flame")){Component->SetVisibility(Age>=0&&Age<7);Position.Z+=Age>1&&Age<7?FMath::Pow((Age-1)/6,2)*1500:0;}
        Component->SetRelativeLocation(Position);
    }
}
