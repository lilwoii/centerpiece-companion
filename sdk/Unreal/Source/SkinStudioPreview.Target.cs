using UnrealBuildTool;
using System.Collections.Generic;
public class SkinStudioPreviewTarget : TargetRules
{
    public SkinStudioPreviewTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V2;
        ExtraModuleNames.Add("SkinStudioPreview");
    }
}
