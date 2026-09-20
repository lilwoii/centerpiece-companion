using UnrealBuildTool;
public class CenterpieceSkinStudio : ModuleRules
{
    public CenterpieceSkinStudio(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore" });
        PrivateDependencyModuleNames.AddRange(new string[] { "Json", "RenderCore", "RHI" });
    }
}
