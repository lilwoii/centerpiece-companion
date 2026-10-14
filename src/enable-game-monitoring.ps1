param([Parameter(Mandatory=$true)][string]$UserSid)
$ErrorActionPreference='Stop'
if($UserSid -notmatch '^S-1-5-21-\d+-\d+-\d+-\d+$'){throw 'Invalid user account'}
$group=Get-LocalGroup -SID 'S-1-5-32-559'
$sid=New-Object System.Security.Principal.SecurityIdentifier($UserSid)
$account=$sid.Translate([System.Security.Principal.NTAccount]).Value
if(!(Get-LocalGroupMember -Group $group.Name | Where-Object {$_.SID.Value -eq $UserSid})){
 Add-LocalGroupMember -Group $group.Name -Member $account
}
