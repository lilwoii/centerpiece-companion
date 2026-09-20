#if WITH_DEV_AUTOMATION_TESTS
#include "Misc/AutomationTest.h"
#include "SkinStudioRuntime.h"
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FSkinStudioImportTest, "Community.SkinStudio.ImportAndEvents", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FSkinStudioImportTest::RunTest(const FString& Parameters)
{
    USkinStudioRuntime* Runtime = NewObject<USkinStudioRuntime>(); FString Error;
    TestFalse(TEXT("Malformed project rejected"), Runtime->LoadProjectJson(TEXT("{}"), Error));
    const FString Json = TEXT("{\"format\":\"centerpiece-skin-studio\",\"version\":1,\"name\":\"Test\",\"canvas\":{\"width\":1920,\"height\":550,\"background\":\"#000000\"},\"duration\":12,\"layers\":[{\"id\":\"layer-a\",\"type\":\"solid\",\"x\":0,\"keyframes\":[{\"property\":\"x\",\"time\":0,\"value\":0,\"easing\":\"linear\"},{\"property\":\"x\",\"time\":10,\"value\":100}]}],\"rules\":[{\"trigger\":\"keyDown\",\"key\":\"KeyA\",\"target\":\"layer-a\",\"effect\":\"ripple\",\"color\":\"#ffffff\",\"strength\":1,\"duration\":1}]}");
    TestTrue(TEXT("Source scene imported"), Runtime->LoadProjectJson(Json, Error));
    const auto Layers = Runtime->EvaluateLayers(5); TestEqual(TEXT("Layer imported"), Layers.Num(), 1);
    if (Layers.Num()) TestEqual(TEXT("Keyframe interpolation"), static_cast<float>(Layers[0].Position.X), 50.f);
    TestFalse(TEXT("Invalid duration rejected"), Runtime->LoadProjectJson(Json.Replace(TEXT("\"duration\":12"), TEXT("\"duration\":5000")), Error));
    TestFalse(TEXT("Invalid numeric type rejected"), Runtime->LoadProjectJson(Json.Replace(TEXT("\"x\":0"), TEXT("\"x\":\"not a number\"")), Error));
    TestFalse(TEXT("Invalid effect rejected"), Runtime->LoadProjectJson(Json.Replace(TEXT("\"effect\":\"ripple\""), TEXT("\"effect\":\"execute\"")), Error));
    const FString FirstKeyRemoved = Json.Replace(TEXT("{\"property\":\"x\",\"time\":0,\"value\":0,\"easing\":\"linear\"},"), TEXT("")).Replace(TEXT("\"value\":100}"), TEXT("\"value\":100,\"easing\":\"ease-in\"}"));
    TestTrue(TEXT("Single destination keyframe imported"), Runtime->LoadProjectJson(FirstKeyRemoved, Error));
    TestEqual(TEXT("Interpolate from base using destination easing"), static_cast<float>(Runtime->EvaluateLayers(5)[0].Position.X), 25.f);
    TestEqual(TEXT("Seek to duration retains final keyframe"), static_cast<float>(Runtime->EvaluateLayers(12)[0].Position.X), 100.f);
    TestTrue(TEXT("Reset source scene"), Runtime->LoadProjectJson(Json, Error));
    Runtime->NotifyInput(TEXT("keyDown"), TEXT("KeyA"), FVector2D::ZeroVector, 0); TestEqual(TEXT("Zero-strength events ignored"), Runtime->GetActiveEffects().Num(), 0);
    Runtime->NotifyInput(TEXT("keyDown"), TEXT("KeyB"), FVector2D::ZeroVector, 1); TestEqual(TEXT("Key matching"), Runtime->GetActiveEffects().Num(), 0);
    Runtime->NotifyInput(TEXT("keyDown"), TEXT("KeyA"), FVector2D::ZeroVector, 1); TestEqual(TEXT("Rule fired"), Runtime->GetActiveEffects().Num(), 1);
    for (int32 I = 0; I < 300; ++I) Runtime->NotifyInput(TEXT("keyDown"), TEXT("KeyA"), FVector2D::ZeroVector, 1);
    TestEqual(TEXT("Bounded event history"), Runtime->GetActiveEffects().Num(), 128);
    TestFalse(TEXT("Failed reimport rejected"), Runtime->LoadProjectJson(TEXT("not json"), Error));
    TestEqual(TEXT("Failed import retains scene"), Runtime->ProjectName, FString(TEXT("Test")));
    const FString ToggleJson = Json.Replace(TEXT("\"effect\":\"ripple\""), TEXT("\"effect\":\"toggle\""));
    TestTrue(TEXT("Toggle scene imported"), Runtime->LoadProjectJson(ToggleJson, Error));
    Runtime->NotifyInput(TEXT("keyDown"), TEXT("KeyA"), FVector2D::ZeroVector, 1); TestFalse(TEXT("First toggle hides"), Runtime->EvaluateLayers(0)[0].Visible);
    Runtime->NotifyInput(TEXT("keyDown"), TEXT("KeyA"), FVector2D::ZeroVector, 1); TestTrue(TEXT("Second toggle restores"), Runtime->EvaluateLayers(0)[0].Visible);
    const FString GroupJson=Json.Replace(TEXT("\"key\":\"KeyA\""),TEXT("\"key\":\"any\",\"keys\":[\"KeyA\",\"KeyD\"]"));
    TestTrue(TEXT("Selected-key group imports"),Runtime->LoadProjectJson(GroupJson,Error));
    Runtime->NotifyInput(TEXT("keyDown"),TEXT("KeyW"),FVector2D::ZeroVector,1);TestEqual(TEXT("Unselected key does not fire"),Runtime->GetActiveEffects().Num(),0);
    Runtime->NotifyInput(TEXT("keyDown"),TEXT("KeyD"),FVector2D::ZeroVector,1);TestEqual(TEXT("Second selected key fires"),Runtime->GetActiveEffects().Num(),1);
    TestFalse(TEXT("Empty key group rejected"),Runtime->LoadProjectJson(GroupJson.Replace(TEXT("[\"KeyA\",\"KeyD\"]"),TEXT("[]")),Error));
    TestFalse(TEXT("Duplicate key group rejected"),Runtime->LoadProjectJson(GroupJson.Replace(TEXT("\"KeyD\""),TEXT("\"KeyA\"")),Error));
    const FString CollectionJson=Json.Replace(TEXT("\"type\":\"solid\""),TEXT("\"type\":\"collection\",\"text\":\"atlas-launch\""));
    TestTrue(TEXT("Native collection scene imports"),Runtime->LoadProjectJson(CollectionJson,Error));
    TestFalse(TEXT("Unknown collection scene rejected"),Runtime->LoadProjectJson(CollectionJson.Replace(TEXT("atlas-launch"),TEXT("../../outside")),Error));
    TestFalse(TEXT("Physical key mask outside layout rejected"),Runtime->LoadProjectJson(Json.Replace(TEXT("\"type\":\"solid\""),TEXT("\"type\":\"solid\",\"keyMask\":[68]")),Error));
    return true;
}
#endif
