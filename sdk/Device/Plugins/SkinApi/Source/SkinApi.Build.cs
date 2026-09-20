using UnrealBuildTool;
public class SkinApi : ModuleRules { public SkinApi(ReadOnlyTargetRules Target):base(Target) { PCHUsage=PCHUsageMode.UseExplicitOrSharedPCHs; PublicDependencyModuleNames.AddRange(new[]{"Core","CoreUObject","Engine"}); } }
