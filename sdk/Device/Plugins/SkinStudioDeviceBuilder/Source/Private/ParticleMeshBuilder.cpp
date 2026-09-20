#include "SkinStudioDeviceBuilder.h"
#include "Engine/StaticMesh.h"
#include "RawMesh.h"
#include "AssetRegistryModule.h"
#include "Materials/Material.h"
#include "Materials/MaterialExpression.h"

bool USkinStudioDeviceBuilder::ConnectHeatmapData(UMaterial* Material, UMaterialExpression* Data)
{
 if(!Material||!Data)return false;
 Material->CustomizedUVs[4].Expression=Data;Material->NumCustomizedUVs=7;return true;
}
bool USkinStudioDeviceBuilder::ConnectParticleVertex(UMaterial* Material, UMaterialExpression* Offset, UMaterialExpression* Coordinates)
{
 if(!Material||!Offset||!Coordinates||Offset->GetOuter()!=Material||Coordinates->GetOuter()!=Material)return false;
 Material->WorldPositionOffset.Expression=Offset;Material->CustomizedUVs[6].Expression=Coordinates;Material->NumCustomizedUVs=7;return true;
}

UStaticMesh* USkinStudioDeviceBuilder::CreateParticleMesh(int32 Count, int64 Seed, const FString& AssetName)
{
 if(Count<1||Count>210||!AssetName.StartsWith(TEXT("Particles_"))||AssetName.Len()>64)return nullptr;
 for(TCHAR C:AssetName)if(!FChar::IsAlnum(C)&&C!='_')return nullptr;
 const FString Path=TEXT("/Game/Companion/Meshes/")+AssetName;
 if(LoadObject<UObject>(nullptr,*(Path+TEXT(".")+AssetName)))return nullptr;
 auto Rand=[&](uint32 Index){uint32 X=uint32(Seed)^((Index+1)*374761393u);X=(X^(X>>13))*1274126177u;return float(double(X^(X>>16))/4294967296.0);};
 FRawMesh Raw;
 const FVector2D Corners[4]={FVector2D(0,0),FVector2D(1,0),FVector2D(1,1),FVector2D(0,1)};
 const int32 Indices[6]={0,1,2,0,2,3};
 for(int32 I=0;I<Count;I++){
  const FVector2D AB(Rand(I*7),Rand(I*7+1)),CD(Rand(I*7+2),Rand(I*7+3));
  for(int32 J=0;J<4;J++)Raw.VertexPositions.Add(FVector((AB.X+Corners[J].X-1)*100,(AB.Y+Corners[J].Y-1)*100,0));
  for(int32 J=0;J<6;J++){
   Raw.WedgeIndices.Add(I*4+Indices[J]);Raw.WedgeTangentX.Add(FVector(1,0,0));Raw.WedgeTangentY.Add(FVector(0,1,0));Raw.WedgeTangentZ.Add(FVector(0,0,1));Raw.WedgeColors.Add(FColor::White);
   Raw.WedgeTexCoords[0].Add(Corners[Indices[J]]);Raw.WedgeTexCoords[1].Add(AB);Raw.WedgeTexCoords[2].Add(CD);Raw.WedgeTexCoords[3].Add(FVector2D(I,0));
   for(int32 K=4;K<7;K++)Raw.WedgeTexCoords[K].Add(FVector2D(0,0));
  }
  Raw.FaceMaterialIndices.Add(0);Raw.FaceMaterialIndices.Add(0);Raw.FaceSmoothingMasks.Add(0);Raw.FaceSmoothingMasks.Add(0);
 }
 if(!Raw.IsValid())return nullptr;
 UPackage* Package=CreatePackage(*Path);auto* Mesh=NewObject<UStaticMesh>(Package,*AssetName,RF_Public|RF_Standalone);
 Mesh->InitResources();auto& Source=Mesh->AddSourceModel();Source.BuildSettings.bRecomputeNormals=false;Source.BuildSettings.bRecomputeTangents=false;Source.BuildSettings.bGenerateLightmapUVs=false;Source.BuildSettings.bUseFullPrecisionUVs=true;
 Source.RawMeshBulkData->SaveRawMesh(Raw);Mesh->GetStaticMaterials().Add(FStaticMaterial());Mesh->Build(false);Mesh->PostEditChange();FAssetRegistryModule::AssetCreated(Mesh);Package->MarkPackageDirty();return Mesh;
}
