$ErrorActionPreference='Stop'
try {
 $ping=New-Object System.Net.NetworkInformation.Ping
 try {$reply=$ping.Send('1.1.1.1',1500);@{reachable=$reply.Status -eq 'Success';latency=if($reply.Status -eq 'Success'){$reply.RoundtripTime}else{$null};target='1.1.1.1'}|ConvertTo-Json -Compress}
 finally {$ping.Dispose()}
} catch {@{reachable=$false;latency=$null;target='1.1.1.1'}|ConvertTo-Json -Compress}
