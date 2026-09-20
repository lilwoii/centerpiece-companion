#include "SkinStudioRuntime.h"
#include "CanvasItem.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "HAL/FileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

namespace
{
FString String(const TSharedPtr<FJsonObject>& Object, const TCHAR* Name, const FString& Fallback = TEXT(""))
{ FString Value; return Object.IsValid() && Object->TryGetStringField(Name, Value) ? Value : Fallback; }
float Number(const TSharedPtr<FJsonObject>& Object, const TCHAR* Name, float Fallback, float Min, float Max)
{ double Value; return Object.IsValid() && Object->TryGetNumberField(Name, Value) && FMath::IsFinite(Value) ? FMath::Clamp(static_cast<float>(Value), Min, Max) : Fallback; }
bool InRange(const TSharedPtr<FJsonObject>& Object, const TCHAR* Name, double Min, double Max, bool Required = false)
{ if (!Object->HasField(Name)) return !Required; double Value; return Object->TryGetNumberField(Name, Value) && FMath::IsFinite(Value) && Value >= Min && Value <= Max; }
bool BoundedString(const TSharedPtr<FJsonObject>& Object, const TCHAR* Name, int32 Limit)
{ if (!Object->HasField(Name)) return true; FString Value; return Object->TryGetStringField(Name, Value) && Value.Len() <= Limit; }
bool WholeNumber(const TSharedPtr<FJsonObject>& Object, const TCHAR* Name)
{ if (!Object->HasField(Name)) return true; double Value; return Object->TryGetNumberField(Name, Value) && FMath::IsFinite(Value) && Value >= 0 && Value <= 4294967295.0 && Value == static_cast<int64>(Value); }
FLinearColor Color(const FString& Text, FLinearColor Fallback = FLinearColor::White)
{ if ((Text.Len() != 7 && Text.Len() != 9) || Text[0] != '#') return Fallback; for (int32 I = 1; I < Text.Len(); ++I) if (!FChar::IsHexDigit(Text[I])) return Fallback; return FLinearColor(FColor::FromHex(Text)); }
float Ease(float Value, const FString& Kind)
{ if (Kind == TEXT("ease-in")) return Value * Value; if (Kind == TEXT("ease-out")) return 1 - (1 - Value) * (1 - Value); if (Kind == TEXT("smooth")) return Value * Value * (3 - 2 * Value); return Value; }
float Animated(const TSharedPtr<FJsonObject>& Layer, const TCHAR* Property, float Base, float Time)
{
    const TArray<TSharedPtr<FJsonValue>>* Frames; if (!Layer->TryGetArrayField(TEXT("keyframes"), Frames)) return Base;
    float BeforeTime = 0, AfterTime = FLT_MAX, Before = Base, After = Base; FString Easing;
    for (const auto& Value : *Frames)
    {
        const auto Frame = Value->AsObject(); if (!Frame.IsValid() || String(Frame, TEXT("property")) != Property) continue;
        const float At = Number(Frame, TEXT("time"), 0, 0, 3600), V = Number(Frame, TEXT("value"), Base, -10000, 10000);
        if (At <= Time && At >= BeforeTime) { BeforeTime = At; Before = V; }
        if (At > Time && At < AfterTime) { AfterTime = At; After = V; Easing = String(Frame, TEXT("easing")); }
    }
    if (AfterTime == FLT_MAX) return Before;
    return FMath::Lerp(Before, After, Ease((Time - BeforeTime) / (AfterTime - BeforeTime), Easing));
}
bool SafeJsonDepth(const FString& Json)
{
    int32 Depth = 0; bool Quoted = false, Escaped = false;
    for (TCHAR C : Json) { if (Quoted) { if (Escaped) Escaped = false; else if (C == '\\') Escaped = true; else if (C == '"') Quoted = false; } else if (C == '"') Quoted = true; else if (C == '{' || C == '[') { if (++Depth > 32) return false; } else if (C == '}' || C == ']') { if (--Depth < 0) return false; } }
    return Depth == 0 && !Quoted;
}
void Tile(UCanvas* Canvas, FVector2D Position, FVector2D Size, FLinearColor Tint, float Rotation = 0)
{ FCanvasTileItem Item(Position, Size, Tint); Item.BlendMode = SE_BLEND_Translucent; Item.Rotation = FRotator(0, 0, Rotation); Item.PivotPoint = FVector2D(.5f, .5f); Canvas->DrawItem(Item); }
}

USkinStudioRuntime::USkinStudioRuntime() { PrimaryComponentTick.bCanEverTick = true; }
bool USkinStudioRuntime::LoadProjectJson(const FString& Json, FString& Error)
{
    auto Fail = [&](const TCHAR* Message) { Error = Message; LastError = Error; return false; };
    if (Json.Len() > 32 * 1024 * 1024 || !SafeJsonDepth(Json)) return Fail(TEXT("Project exceeds the supported JSON size or depth."));
    TSharedPtr<FJsonObject> Parsed;
    if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Json), Parsed) || !Parsed.IsValid()) return Fail(TEXT("Project JSON could not be read."));
    if (String(Parsed, TEXT("format")) != TEXT("centerpiece-skin-studio") || !InRange(Parsed, TEXT("version"), 1, 1, true)) return Fail(TEXT("Unsupported Skin Studio project format."));
    if (!InRange(Parsed, TEXT("duration"), 1, 120) || !InRange(Parsed, TEXT("fps"), 1, 60) || !WholeNumber(Parsed, TEXT("fps"))) return Fail(TEXT("Project duration or frame rate is outside the supported range."));
    if (!BoundedString(Parsed, TEXT("name"), 120) || !BoundedString(Parsed, TEXT("description"), 2000)) return Fail(TEXT("Project metadata is invalid or too long."));
    const TSharedPtr<FJsonObject>* Canvas;
    if (!Parsed->TryGetObjectField(TEXT("canvas"), Canvas) || Number(*Canvas, TEXT("width"), 0, 0, 10000) != 1920 || Number(*Canvas, TEXT("height"), 0, 0, 10000) != 550) return Fail(TEXT("The scene canvas must be 1920 by 550."));
    const TArray<TSharedPtr<FJsonValue>> *Layers, *Rules;
    if (!Parsed->TryGetArrayField(TEXT("layers"), Layers) || Layers->Num() > 48 || !Parsed->TryGetArrayField(TEXT("rules"), Rules) || Rules->Num() > 96) return Fail(TEXT("Project layer or interaction counts are invalid."));
    TSet<FString> Ids; TArray<FString> Warnings; int32 TotalFrames = 0;
    const TSet<FString> Types = { TEXT("solid"), TEXT("gradient"), TEXT("wave"), TEXT("ripple"), TEXT("particles"), TEXT("stars"), TEXT("rain"), TEXT("snow"), TEXT("fireflies"), TEXT("orbit"), TEXT("aurora"), TEXT("plasma"), TEXT("grid"), TEXT("rings"), TEXT("text"), TEXT("image"), TEXT("heatmap"), TEXT("rocket"), TEXT("nebula"), TEXT("meteors"), TEXT("collection") };
    const TSet<FString> CollectionIds = {TEXT("lantern-festival"),TEXT("paper-ocean"),TEXT("neon-speedway"),TEXT("clockwork-garden"),TEXT("prism-bloom"),TEXT("tidal-observatory"),TEXT("alpine-reflection"),TEXT("storm-window"),TEXT("ember-forge"),TEXT("moon-tranquility"),TEXT("atlas-launch")};
    struct FBound { const TCHAR* Name; double Min; double Max; };
    const FBound Bounds[] = { {TEXT("x"),-7680,7680}, {TEXT("y"),-2200,2200}, {TEXT("width"),1,7680}, {TEXT("height"),1,2200}, {TEXT("rotation"),-3600,3600}, {TEXT("opacity"),0,1}, {TEXT("size"),1,300}, {TEXT("speed"),0,8}, {TEXT("density"),1,200}, {TEXT("reactivity"),0,4}, {TEXT("fontSize"),8,256}, {TEXT("seed"),0,4294967295.0} };
    const TSet<FString> Properties = { TEXT("x"), TEXT("y"), TEXT("width"), TEXT("height"), TEXT("rotation"), TEXT("opacity"), TEXT("size") };
    const TSet<FString> Easings = { TEXT("linear"), TEXT("ease-in"), TEXT("ease-out"), TEXT("smooth") };
    const float SceneDuration = Number(Parsed, TEXT("duration"), 12, 1, 120);
    for (const auto& Value : *Layers)
    {
        if (!Value.IsValid() || Value->Type != EJson::Object) return Fail(TEXT("A layer is not an object."));
        const auto Layer = Value->AsObject(); if (!Layer.IsValid()) return Fail(TEXT("A layer is not an object."));
        const FString Id = String(Layer, TEXT("id")), Type = String(Layer, TEXT("type"));
        if (!Types.Contains(Type)) return Fail(TEXT("The scene contains an unsupported layer type."));
        if (Type == TEXT("collection") && !CollectionIds.Contains(String(Layer, TEXT("text")))) return Fail(TEXT("The collection scene identifier is not supported."));
        const TArray<TSharedPtr<FJsonValue>>* KeyMask;
        if (Layer->HasField(TEXT("keyMask")))
        {
            if (!Layer->TryGetArrayField(TEXT("keyMask"),KeyMask) || KeyMask->Num()<1 || KeyMask->Num()>68) return Fail(TEXT("A key mask must contain 1 to 68 key indices."));
            TSet<int32> UniqueKeys;
            for(const auto& MaskValue:*KeyMask){double Index;if(!MaskValue.IsValid() || !MaskValue->TryGetNumber(Index) || !FMath::IsFinite(Index) || Index<0 || Index>67 || FMath::FloorToInt(Index)!=Index || UniqueKeys.Contains(static_cast<int32>(Index)))return Fail(TEXT("A key mask contains an invalid or duplicate index."));UniqueKeys.Add(static_cast<int32>(Index));}
            Warnings.AddUnique(TEXT("Key masks are preserved in source JSON; implement physical-key clipping in your native renderer."));
        }
        if (Id.IsEmpty() || Id.Len() > 128 || Ids.Contains(Id)) return Fail(TEXT("Layer identifiers must be unique and bounded.")); Ids.Add(Id);
        if (!BoundedString(Layer, TEXT("name"), 120) || !BoundedString(Layer, TEXT("text"), 512) || !BoundedString(Layer, TEXT("blend"), 32) || !WholeNumber(Layer, TEXT("density")) || !WholeNumber(Layer, TEXT("seed"))) return Fail(TEXT("A layer name, text or integer setting is invalid."));
        for (const FBound& Bound : Bounds) if (!InRange(Layer, Bound.Name, Bound.Min, Bound.Max)) return Fail(TEXT("A layer property is invalid or outside its supported range."));
        const TArray<TSharedPtr<FJsonValue>>* Frames;
        if (Layer->HasField(TEXT("keyframes")) && !Layer->TryGetArrayField(TEXT("keyframes"), Frames)) return Fail(TEXT("Keyframes must be an array."));
        if (Layer->TryGetArrayField(TEXT("keyframes"), Frames)) { TotalFrames += Frames->Num(); if (Frames->Num() > 256 || TotalFrames > 2048) return Fail(TEXT("A project contains too many keyframes.")); for (const auto& FrameValue : *Frames) { if (!FrameValue.IsValid() || FrameValue->Type != EJson::Object) return Fail(TEXT("A keyframe is not an object.")); const auto Frame = FrameValue->AsObject(); const FString Property = String(Frame, TEXT("property")); if (!Properties.Contains(Property) || !Easings.Contains(String(Frame, TEXT("easing"), TEXT("linear"))) || !InRange(Frame, TEXT("time"), 0, SceneDuration, true)) return Fail(TEXT("A keyframe property, easing or time is invalid.")); for (const FBound& Bound : Bounds) if (Property == Bound.Name && !InRange(Frame, TEXT("value"), Bound.Min, Bound.Max, true)) return Fail(TEXT("A keyframe value is outside its supported range.")); } }
        if (Type == TEXT("image")) Warnings.AddUnique(TEXT("Image data remains in JSON; import the image as an Unreal texture and draw it in a custom renderer."));
        if (String(Layer, TEXT("blend"), TEXT("source-over")) != TEXT("source-over")) Warnings.AddUnique(TEXT("The Canvas scaffold uses normal alpha blending; custom blend modes need native materials."));
    }
    const TSet<FString> Triggers = { TEXT("keyDown"), TEXT("keyUp"), TEXT("pointer"), TEXT("beat"), TEXT("caps") }, EffectTypes = { TEXT("ripple"), TEXT("burst"), TEXT("flash"), TEXT("pulse"), TEXT("toggle"), TEXT("heat"), TEXT("launch"), TEXT("sparkle"), TEXT("shockwave") };
    for (const auto& Value : *Rules)
    {
        if (!Value.IsValid() || Value->Type != EJson::Object) return Fail(TEXT("An interaction rule is not an object."));
        const auto Rule=Value->AsObject(); if(!Rule.IsValid())return Fail(TEXT("An interaction rule is not an object."));
        const FString Target=String(Rule,TEXT("target"),TEXT("all"));
        if(Target!=TEXT("all")&&!Ids.Contains(Target))return Fail(TEXT("An interaction targets a missing layer."));
        if(!BoundedString(Rule,TEXT("key"),128)||!Triggers.Contains(String(Rule,TEXT("trigger")))||!EffectTypes.Contains(String(Rule,TEXT("effect")))||!InRange(Rule,TEXT("strength"),0,4)||!InRange(Rule,TEXT("duration"),.05,30))return Fail(TEXT("An interaction type, key, strength or duration is invalid."));
        if(Rule->HasField(TEXT("keys")))
        {
            const TArray<TSharedPtr<FJsonValue>>* Keys;if(!Rule->TryGetArrayField(TEXT("keys"),Keys)||Keys->Num()<1||Keys->Num()>68)return Fail(TEXT("A key group must contain 1 to 68 keys."));
            TSet<FString> UniqueKeys;for(const auto& KeyValue:*Keys){FString Key;if(!KeyValue.IsValid()||!KeyValue->TryGetString(Key)||Key.IsEmpty()||Key.Len()>128||Key==TEXT("any")||UniqueKeys.Contains(Key))return Fail(TEXT("A key group contains an invalid or duplicate key."));UniqueKeys.Add(Key);}
        }
    }
    // Commit only a completely parsed bounded document; a failed import keeps the current scene.
    Document = Parsed; ProjectName = String(Parsed, TEXT("name"), TEXT("Untitled skin")).Left(120); Duration = SceneDuration;
    Background = Color(String(*Canvas, TEXT("background")), FLinearColor::Black); PreviewWarnings = Warnings;
    PreviewWarnings.Add(TEXT("Community source preview: Canvas effects approximate the browser renderer. Finalmouse runtime integration is unverified."));
    Playhead = RuntimeSeconds = 0; Effects.Reset(); ToggleStates.Reset(); Error.Empty(); LastError.Empty(); return true;
}
bool USkinStudioRuntime::LoadBundledProject(FString& Error)
{
    FString Json; const FString File = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Studio/Scene.json"));
    if (IFileManager::Get().FileSize(*File) > 32 * 1024 * 1024) { Error = TEXT("Scene.json exceeds the 32 MiB project limit."); LastError = Error; return false; }
    if (!FFileHelper::LoadFileToString(Json, *File)) { Error = TEXT("Content/Studio/Scene.json was not found. Export a project from Skin Studio first."); LastError = Error; return false; }
    return LoadProjectJson(Json, Error);
}
void USkinStudioRuntime::Seek(float Seconds) { Playhead = FMath::Clamp(FMath::IsFinite(Seconds) ? Seconds : 0, 0.f, Duration); Effects.Reset(); }
void USkinStudioRuntime::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* TickFunction)
{
    Super::TickComponent(DeltaTime, TickType, TickFunction);
    const float Step = FMath::Clamp(DeltaTime, 0.f, .25f); RuntimeSeconds += Step;
    if (Playing) Playhead = FMath::Fmod(Playhead + Step, Duration);
    Effects.RemoveAll([&](const FStudioEffectEvent& Event) { return RuntimeSeconds - Event.StartedAt >= Event.Duration; });
}
void USkinStudioRuntime::NotifyInput(const FString& Trigger, const FString& Key, FVector2D Position, float Strength)
{
    if (!Document.IsValid() || Trigger.Len() > 32 || Key.Len() > 128 || !FMath::IsFinite(Position.X) || !FMath::IsFinite(Position.Y) || !FMath::IsFinite(Strength) || Strength <= 0) return;
    const TArray<TSharedPtr<FJsonValue>>* Rules; if (!Document->TryGetArrayField(TEXT("rules"), Rules)) return;
    for (const auto& Value : *Rules)
    {
        const auto Rule = Value->AsObject(); if (String(Rule, TEXT("trigger")) != Trigger) continue;
        if (Trigger == TEXT("keyDown") || Trigger == TEXT("keyUp"))
        {
            const TArray<TSharedPtr<FJsonValue>>* Keys;
            if(Rule->TryGetArrayField(TEXT("keys"),Keys)){bool Matched=false;for(const auto& KeyValue:*Keys)if(KeyValue->AsString()==Key){Matched=true;break;}if(!Matched)continue;}
            else{const FString MatchKey=String(Rule,TEXT("key"),TEXT("any"));if(MatchKey!=TEXT("any")&&MatchKey!=Key)continue;}
        }
        FStudioEffectEvent Event; Event.Target = String(Rule, TEXT("target"), TEXT("all")); Event.Effect = String(Rule, TEXT("effect"));
        if (Number(Rule, TEXT("strength"), 1, 0, 5) <= 0) continue;
        if (Event.Effect == TEXT("toggle")) { const bool* Old = ToggleStates.Find(Event.Target); ToggleStates.Add(Event.Target, Old ? !*Old : true); continue; }
        Event.Position = FVector2D(FMath::Clamp(static_cast<float>(Position.X), 0.f, 1920.f), FMath::Clamp(static_cast<float>(Position.Y), 0.f, 550.f));
        Event.Color = Color(String(Rule, TEXT("color"))); Event.Strength = FMath::Clamp(Number(Rule, TEXT("strength"), 1, 0, 4) * FMath::Clamp(Strength, 0.f, 4.f), 0.f, 8.f);
        Event.Duration = Number(Rule, TEXT("duration"), 1, .05f, 30); Event.StartedAt = RuntimeSeconds;
        if (Effects.Num() >= 128) Effects.RemoveAt(0); Effects.Add(Event);
    }
}
TArray<FStudioEffectEvent> USkinStudioRuntime::GetActiveEffects() const { return Effects; }
TArray<FStudioLayerFrame> USkinStudioRuntime::EvaluateLayers(float Seconds) const
{
    TArray<FStudioLayerFrame> Result; if (!Document.IsValid()) return Result;
    const TArray<TSharedPtr<FJsonValue>>* Layers; if (!Document->TryGetArrayField(TEXT("layers"), Layers)) return Result;
    const float Time = FMath::Clamp(FMath::IsFinite(Seconds) ? Seconds : 0.f, 0.f, Duration);
    for (const auto& Value : *Layers)
    {
        const auto Layer = Value->AsObject(); FStudioLayerFrame Frame; Frame.Id = String(Layer, TEXT("id")); Frame.Type = String(Layer, TEXT("type")); Frame.Text = String(Layer, TEXT("text")).Left(2048);
        Frame.Position = FVector2D(Animated(Layer, TEXT("x"), Number(Layer, TEXT("x"), 0, -10000, 10000), Time), Animated(Layer, TEXT("y"), Number(Layer, TEXT("y"), 0, -10000, 10000), Time));
        Frame.Size = FVector2D(FMath::Max(1.f, Animated(Layer, TEXT("width"), Number(Layer, TEXT("width"), 1920, 1, 10000), Time)), FMath::Max(1.f, Animated(Layer, TEXT("height"), Number(Layer, TEXT("height"), 550, 1, 10000), Time)));
        Frame.Rotation = Animated(Layer, TEXT("rotation"), Number(Layer, TEXT("rotation"), 0, -3600, 3600), Time); Frame.Opacity = FMath::Clamp(Animated(Layer, TEXT("opacity"), Number(Layer, TEXT("opacity"), 1, 0, 1), Time), 0.f, 1.f);
        Frame.ParticleSize = FMath::Clamp(Animated(Layer, TEXT("size"), Number(Layer, TEXT("size"), 24, 1, 500), Time), 1.f, 500.f);
        Frame.Color = Color(String(Layer, TEXT("color"))); Frame.Color2 = Color(String(Layer, TEXT("color2"))); Frame.Speed = Number(Layer, TEXT("speed"), 1, 0, 8); Frame.Reactivity = Number(Layer, TEXT("reactivity"), 1, 0, 4); Frame.FontSize = Number(Layer, TEXT("fontSize"), 72, 8, 256);
        Frame.Density = static_cast<int32>(Number(Layer, TEXT("density"), 40, 0, 200)); Frame.Seed = static_cast<int32>(Number(Layer, TEXT("seed"), 1, 0, 2147483000.f));
        Layer->TryGetBoolField(TEXT("visible"), Frame.Visible);
        if (const bool* Toggle = ToggleStates.Find(Frame.Id)) { if (*Toggle) Frame.Visible = !Frame.Visible; }
        if (const bool* Toggle = ToggleStates.Find(TEXT("all"))) { if (*Toggle) Frame.Visible = !Frame.Visible; }
        float Pulse = 0; for (const auto& Event : Effects) if ((Event.Target == TEXT("all") || Event.Target == Frame.Id) && Event.Effect == TEXT("pulse")) { const float Progress = FMath::Clamp((RuntimeSeconds - Event.StartedAt) / Event.Duration, 0.f, 1.f); Pulse += .1f * Event.Strength * Frame.Reactivity * FMath::Sin(PI * Progress) * FMath::Pow(1 - Progress, .6f); } Frame.Position -= Frame.Size * Pulse * .5f; Frame.Size *= 1 + Pulse;
        Result.Add(Frame);
    }
    return Result;
}
void USkinStudioRuntime::DrawToCanvas(UCanvas* Canvas)
{
    if (!Canvas) return; const float Scale = FMath::Min(Canvas->SizeX / 1920.f, Canvas->SizeY / 550.f); const FVector2D Origin((Canvas->SizeX - 1920 * Scale) / 2, (Canvas->SizeY - 550 * Scale) / 2);
    Tile(Canvas, Origin, FVector2D(1920, 550) * Scale, Background);
    auto Line = [&](FVector2D A, FVector2D B, FLinearColor Tint, float Width = 1) { Canvas->K2_DrawLine(Origin + A * Scale, Origin + B * Scale, FMath::Max(1.f, Width * Scale), Tint); };
    const TArray<FStudioLayerFrame> Evaluated = EvaluateLayers(Playhead);
    for (const auto& Layer : Evaluated)
    {
        if (!Layer.Visible || Layer.Opacity <= 0) continue; FLinearColor Tint = Layer.Color; Tint.A *= Layer.Opacity;
        if (Layer.Type == TEXT("solid")) Tile(Canvas, Origin + Layer.Position * Scale, Layer.Size * Scale, Tint, Layer.Rotation);
        else if (Layer.Type == TEXT("gradient") || Layer.Type == TEXT("plasma") || Layer.Type == TEXT("aurora"))
        { for (int32 I = 0; I < 64; ++I) { float Alpha = I / 63.f; if (Layer.Type != TEXT("gradient")) Alpha = .5f + .5f * FMath::Sin(Alpha * 8 + Playhead * Layer.Speed); FLinearColor C = FMath::Lerp(Layer.Color, Layer.Color2, Alpha); C.A *= Layer.Opacity; Tile(Canvas, Origin + (Layer.Position + FVector2D(I * Layer.Size.X / 64, 0)) * Scale, FVector2D(Layer.Size.X / 64 + 1, Layer.Size.Y) * Scale, C); } }
        else if (Layer.Type == TEXT("text")) { const float TextScale = Layer.FontSize / 36 * Scale; Canvas->K2_DrawText(GEngine ? GEngine->GetLargeFont() : nullptr, Layer.Text, Origin + Layer.Position * Scale, FVector2D(TextScale, TextScale), Tint, 0, FLinearColor::Transparent, FVector2D::ZeroVector, false, false, false, FLinearColor::Black); }
        else if (Layer.Type == TEXT("grid")) { const float Gap = FMath::Max(FMath::Max(8.f, Layer.ParticleSize), static_cast<float>(FMath::Max(Layer.Size.X, Layer.Size.Y)) / 128); for (float X = 0; X <= Layer.Size.X; X += Gap) Line(Layer.Position + FVector2D(X, 0), Layer.Position + FVector2D(X, Layer.Size.Y), Tint); for (float Y = 0; Y <= Layer.Size.Y; Y += Gap) Line(Layer.Position + FVector2D(0, Y), Layer.Position + FVector2D(Layer.Size.X, Y), Tint); }
        else if (Layer.Type == TEXT("wave")) { FVector2D Previous = Layer.Position; for (int32 I = 0; I <= 120; ++I) { FVector2D P = Layer.Position + FVector2D(I * Layer.Size.X / 120, Layer.Size.Y * .5f + FMath::Sin(I * .14f + Playhead * Layer.Speed) * Layer.Size.Y * .35f); if (I) Line(Previous, P, Tint, 3); Previous = P; } }
        else if (Layer.Type != TEXT("image"))
        { FRandomStream Random(Layer.Seed); for (int32 I = 0; I < Layer.Density; ++I) { const float X = Random.FRand() * Layer.Size.X, Phase = Random.FRand(), Size = FMath::Max(1.f, Layer.ParticleSize * (.15f + Random.FRand() * .35f)); FVector2D P = Layer.Position + FVector2D(X, FMath::Fmod(Phase + Playhead * Layer.Speed * .05f + 100, 1.f) * Layer.Size.Y); if (Layer.Type == TEXT("orbit") || Layer.Type == TEXT("rings") || Layer.Type == TEXT("ripple")) P = Layer.Position + Layer.Size * .5f + FVector2D(FMath::Cos(Phase * 2 * PI + Playhead * Layer.Speed), FMath::Sin(Phase * 2 * PI + Playhead * Layer.Speed)) * FMath::Min(Layer.Size.X, Layer.Size.Y) * .35f; if (Layer.Type == TEXT("rain")) Line(P, P + FVector2D(-3, Size * 3), Tint, 2); else Tile(Canvas, Origin + P * Scale, FVector2D(Size, Size) * Scale, Tint); } }
    }
    for (const auto& Event : Effects)
    {
        const float Age = FMath::Clamp((RuntimeSeconds - Event.StartedAt) / Event.Duration, 0.f, 1.f); FLinearColor Tint = Event.Color; Tint.A *= (1 - Age) * FMath::Min(Event.Strength, 1.f);
        if (Event.Effect == TEXT("flash")) { for (const auto& Layer : Evaluated) if (Layer.Visible && (Event.Target == TEXT("all") || Event.Target == Layer.Id)) { FLinearColor Flash = Tint; Flash.A *= FMath::Min(Layer.Reactivity, 1.f); Tile(Canvas, Origin + Layer.Position * Scale, Layer.Size * Scale, Flash); } }
        else if (Event.Effect == TEXT("ripple") || Event.Effect == TEXT("burst") || Event.Effect == TEXT("heat") || Event.Effect==TEXT("shockwave")) { const float Radius = (Event.Effect == TEXT("heat") ? 25 : 10 + Age * (Event.Effect==TEXT("shockwave")?420:180)) * Event.Strength; for (int32 I = 0; I < 48; ++I) { const float A = I * PI * 2 / 48, B = (I + 1) * PI * 2 / 48; Line(Event.Position + FVector2D(FMath::Cos(A), FMath::Sin(A)) * Radius, Event.Position + FVector2D(FMath::Cos(B), FMath::Sin(B)) * Radius, Tint, Event.Effect == TEXT("heat") ? 14 : 3); } }
        else if(Event.Effect==TEXT("sparkle")){for(int32 I=0;I<18;++I){const float Angle=I*2.399f;const FVector2D P=Event.Position+FVector2D(FMath::Cos(Angle),FMath::Sin(Angle))*(20+Age*120)*Event.Strength;Line(P-FVector2D(4,0),P+FVector2D(4,0),Tint,2);Line(P-FVector2D(0,4),P+FVector2D(0,4),Tint,2);}}
    }
}
