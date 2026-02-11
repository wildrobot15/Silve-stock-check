# CrowdStrike Threat Hunt Pack (News-Driven, Non-Repeating)

## Note on freshness
I could not directly pull live articles from the listed security news sites in this environment due outbound network 403 restrictions. Use this pack as a **deduplicated hunt set** aligned to the most common high-impact stories these outlets typically cover, then map each query block to your last-3-day headlines.

---

## How to avoid repeating threats
Use one row per **unique technique** (not per article). If multiple sites report the same campaign family, hunt it once.

| Technique bucket (hunt once) | Typical news overlap sources |
|---|---|
| Initial access via phishing / malicious attachment | THN, Dark Reading, Help Net Security, IT Security Guru |
| Public-facing app exploit (edge devices, VPN, firewall, web app) | THN, The Register, CyberScoop |
| Credential theft + account abuse (MFA bypass, token/session theft) | Krebs, Dark Reading, CyberScoop |
| LOLBins / script interpreter abuse (PowerShell, rundll32, mshta) | THN, WeLiveSecurity, Help Net Security |
| Ransomware execution + shadow copy deletion | THN, Dark Reading, The Register |
| Data staging/exfiltration to cloud tools | Krebs, CyberScoop, Dark Reading |
| C2 beaconing (DNS/HTTP periodic patterns) | THN, WeLiveSecurity |
| Lateral movement + remote admin abuse | Dark Reading, The Register |
| Defense evasion (security tool tampering, BYOVD) | THN, WeLiveSecurity, Dark Reading |
| Supply-chain/package compromise | THN, Help Net Security, CyberScoop |

---

## CrowdStrike hunting queries (LogScale-style)

> Adjust field names to your tenant schema (common fields: `event_simpleName`, `FileName`, `CommandLine`, `RemoteIP`, `DomainName`, `UserName`, `ComputerName`, `SHA256HashData`).

### 1) Phishing payload execution (Office -> script/LOLBin)
```logscale
#event_simpleName=ProcessRollup2
| ImageFileName=/\\(winword|excel|powerpnt|outlook)\.exe$/i
| CommandLine=/\\b(powershell|cmd\.exe|wscript|cscript|mshta|rundll32)\\b/i
| groupBy([ComputerName, UserName, ParentBaseFileName, FileName, CommandLine], function=[count(as=hits), min(@timestamp), max(@timestamp)])
| sort(hits, order=desc)
```

### 2) Suspicious child process from browser (drive-by / fake update)
```logscale
#event_simpleName=ProcessRollup2
| ParentBaseFileName=/\\b(chrome|msedge|firefox|iexplore)\.exe$/i
| FileName=/\\b(mshta|powershell|cmd|wscript|cscript|rundll32|regsvr32)\.exe$/i
| groupBy([ComputerName, UserName, ParentBaseFileName, FileName, CommandLine], function=count(as=hits))
```

### 3) Possible credential dumping behavior
```logscale
#event_simpleName=ProcessRollup2
| CommandLine=/\\b(procdump(64)?\.exe.*lsass|rundll32.*comsvcs.*MiniDump|sekurlsa|lsass\.exe)\\b/i
| groupBy([ComputerName, UserName, FileName, CommandLine, SHA256HashData], function=[count(as=hits), min(@timestamp), max(@timestamp)])
```

### 4) Ransomware precursor: shadow copy and recovery tampering
```logscale
#event_simpleName=ProcessRollup2
| CommandLine=/\\b(vssadmin\s+delete\s+shadows|wmic\s+shadowcopy\s+delete|bcdedit\s*\/set\s*\{default\}\s*recoveryenabled\s*no|wbadmin\s+delete\s+catalog)\\b/i
| groupBy([ComputerName, UserName, FileName, CommandLine], function=count(as=hits))
```

### 5) Defense evasion: security tool/service tampering
```logscale
#event_simpleName=ProcessRollup2
| CommandLine=/\\b(sc\s+(stop|config)|net\s+stop|taskkill\s+\/f)\\b/i
| CommandLine=/\\b(defender|crowdstrike|falcon|sentinel|carbonblack|sophos|symantec|trend|edr|av)\\b/i
| groupBy([ComputerName, UserName, CommandLine], function=count(as=hits))
```

### 6) Public-facing exploit follow-on (web/service spawn)
```logscale
#event_simpleName=ProcessRollup2
| ParentBaseFileName=/\\b(w3wp|httpd|nginx|tomcat|java|php-cgi|node|sshd)\.exe?$/i
| FileName=/\\b(cmd|sh|bash|powershell|python|perl|nc|certutil|bitsadmin)\.exe?$/i
| groupBy([ComputerName, ParentBaseFileName, FileName, CommandLine], function=count(as=hits))
```

### 7) Suspicious scheduled task / persistence creation
```logscale
#event_simpleName=ProcessRollup2
| CommandLine=/\\b(schtasks\s+\/create|New-ScheduledTask|Register-ScheduledTask|at\s+\\d{1,2}:\\d{2})\\b/i
| groupBy([ComputerName, UserName, CommandLine], function=[count(as=hits), min(@timestamp), max(@timestamp)])
```

### 8) Remote admin / lateral movement abuse
```logscale
#event_simpleName=ProcessRollup2
| CommandLine=/\\b(psexec|wmic\s+\/node:|winrs|mstsc|ssh\s+|net\s+use\\s+\\\\)\\b/i
| groupBy([ComputerName, UserName, FileName, CommandLine], function=count(as=hits))
```

### 9) High-risk outbound connections from script engines
```logscale
#event_simpleName=NetworkConnectIP4
| InitiatingProcessFileName=/\\b(powershell|cmd|wscript|cscript|mshta|rundll32|regsvr32)\.exe$/i
| !RemoteIP in ["10.0.0.0/8","172.16.0.0/12","192.168.0.0/16"]
| groupBy([ComputerName, UserName, InitiatingProcessFileName, RemoteIP, RemotePort, DomainName], function=count(as=hits))
| sort(hits, order=desc)
```

### 10) DNS tunneling / beacon-like patterns
```logscale
#event_simpleName=DnsRequest
| DomainName=/\./
| eval(label_count := array:length(split(DomainName, ".")))
| where label_count > 4
| groupBy([ComputerName, UserName, DomainName], function=count(as=queries))
| where queries > 50
| sort(queries, order=desc)
```

### 11) Suspicious archive/exfil staging activity
```logscale
#event_simpleName=ProcessRollup2
| CommandLine=/\\b(7z|winrar|rar|tar|Compress-Archive|makecab)\\b/i
| CommandLine=/\\b(-p|-hp|password|\\.7z|\\.zip|\\.rar)\\b/i
| groupBy([ComputerName, UserName, FileName, CommandLine], function=count(as=hits))
```

### 12) Cloud storage exfil tools (rclone/megacmd/aws cli etc.)
```logscale
#event_simpleName=ProcessRollup2
| CommandLine=/\\b(rclone|megacmd|aws\s+s3|azcopy|gsutil|dropbox|onedrive)\\b/i
| groupBy([ComputerName, UserName, FileName, CommandLine], function=count(as=hits))
```

### 13) Encoded PowerShell / obfuscated script execution
```logscale
#event_simpleName=ProcessRollup2
| FileName=/\\bpowershell(\.exe)?$/i
| CommandLine=/\\b(-enc|-encodedcommand|frombase64string|iex\(|invoke-expression)\\b/i
| groupBy([ComputerName, UserName, CommandLine], function=count(as=hits))
| sort(hits, order=desc)
```

### 14) Unsigned binary execution from temp/user-writable paths
```logscale
#event_simpleName=ProcessRollup2
| ImageFileName=/\\b(AppData|Temp|ProgramData|Downloads)\\b/i
| groupBy([ComputerName, UserName, ImageFileName, SHA256HashData], function=count(as=hits))
| sort(hits, order=desc)
```

### 15) Potential BYOVD indicator (known driver load abuse patterns)
```logscale
#event_simpleName=DriverLoad
| FileName=/\\b(rtcore64|gdrv|aswArPot|dbutil|iqvw64e|capcom)\\.sys$/i
| groupBy([ComputerName, UserName, FileName, SHA256HashData], function=[count(as=hits), min(@timestamp), max(@timestamp)])
```

---

## Practical workflow for your shift
1. Pull top headlines from each site for last 72 hours.
2. Map each headline to one of the 10 technique buckets above.
3. Remove duplicates (same threat family/TTP => one bucket only).
4. Run the corresponding query pack.
5. Pivot on `SHA256HashData`, `RemoteIP`, `DomainName`, `UserName`, `ComputerName`.
6. Escalate only hosts with **2+ correlated detections across different buckets**.

---

## Optional: quick scoring model
- +3: Known malicious hash/domain/IP match
- +2: Credential access / defense evasion behavior
- +2: External C2/exfil connection
- +1: Persistence change
- +1: LOLBin misuse

Escalate at score **>=5**.
