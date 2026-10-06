#define ProductName "Sistema de Control de Pagos"
#define ProductVersion "1.0.0"
#define Publisher "I.E.I. N.° 85 - María Inmaculada Concepción"

[Setup]
AppId={{A61B4328-5E0C-4B76-9854-CA38B0A15421}
AppName={#ProductName}
AppVersion={#ProductVersion}
AppPublisher={#Publisher}
DefaultDirName={autopf}\Sistema de Control de Pagos
DefaultGroupName={#ProductName}
OutputDir=..\output
OutputBaseFilename=SistemaControlPagos-Setup-{#ProductVersion}
SetupIconFile=..\assets\SistemaControlPagos.ico
UninstallDisplayIcon={app}\SistemaControlPagos.exe
Compression=lzma2/fast
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
DisableProgramGroupPage=yes
SetupLogging=yes

[Files]
Source: "..\..\artifacts\production\backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\artifacts\production\frontend\*"; DestDir: "{app}\frontend"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\artifacts\production\manifest.json"; DestDir: "{app}"; DestName: "version.json"; Flags: ignoreversion
Source: "..\..\artifacts\production\migration-tools\*"; DestDir: "{app}\migration-tools"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\vendor\node\v24.20.0\node.exe"; DestDir: "{app}\runtime\node"; Flags: ignoreversion
Source: "..\vendor\node\v24.20.0\LICENSE"; DestDir: "{app}\licenses\node"; Flags: ignoreversion
Source: "..\vendor\winsw\2.12.0\WinSW-x64.exe"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\vendor\winsw\2.12.0\LICENSE.txt"; DestDir: "{app}\licenses\winsw"; Flags: ignoreversion
Source: "..\templates\*.xml"; DestDir: "{app}\templates"; Flags: ignoreversion
Source: "..\scripts\*.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\build-output\launcher\SistemaControlPagos.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\scripts\production\backup.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\..\scripts\production\restore.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\..\scripts\production\Common.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\..\THIRD_PARTY_NOTICES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\docs\INSTALLER.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\docs\INSTALLATION.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\docs\UPGRADE.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\docs\BACKUP_RESTORE.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\docs\UNINSTALL.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\docs\TROUBLESHOOTING.md"; DestDir: "{app}\docs"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#ProductName}"; Filename: "{app}\SistemaControlPagos.exe"
Name: "{autoprograms}\{#ProductName} - Crear respaldo"; Filename: "{app}\SistemaControlPagos.exe"; Parameters: "/backup"
Name: "{autodesktop}\{#ProductName}"; Filename: "{app}\SistemaControlPagos.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Crear un acceso directo en el escritorio"; GroupDescription: "Accesos directos:"; Flags: unchecked

[Code]
var
  DatabasePage, AdminPage: TInputQueryWizardPage;

function SetEnvironmentVariable(lpName, lpValue: string): Boolean;
  external 'SetEnvironmentVariableW@kernel32.dll stdcall';

function PowerShellPath: string;
begin
  Result := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
end;

function DataRootValue: string;
begin
  Result := ExpandConstant('{param:DATA_ROOT|{commonappdata}\SistemaControlPagos}');
end;

function BackendPortValue: string;
begin
  Result := ExpandConstant('{param:BACKEND_PORT|3001}');
end;

function FrontendPortValue: string;
begin
  Result := ExpandConstant('{param:FRONTEND_PORT|3000}');
end;

function ServiceSuffixValue: string;
begin
  Result := ExpandConstant('{param:SERVICE_SUFFIX|}');
end;

function TaskSuffixValue: string;
begin
  Result := ExpandConstant('{param:TASK_SUFFIX|}');
end;

function BackupTimeValue: string;
begin
  Result := ExpandConstant('{param:BACKUP_TIME|02:00}');
end;

function RunPowerShell(const ScriptName, Parameters: string): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(PowerShellPath,
    '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
    ExpandConstant('{app}\scripts\') + ScriptName + '" ' + Parameters,
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

procedure InitializeWizard;
begin
  DatabasePage := CreateInputQueryPage(wpSelectDir, 'Base de datos PostgreSQL',
    'Conexión para la base de datos productiva local',
    'Indique una instalación PostgreSQL existente. La contraseña no se escribirá en el log ni en la línea de comandos.');
  DatabasePage.Add('Directorio bin de PostgreSQL:', False);
  DatabasePage.Add('Servidor:', False);
  DatabasePage.Add('Puerto:', False);
  DatabasePage.Add('Base de datos:', False);
  DatabasePage.Add('Usuario:', False);
  DatabasePage.Add('Contraseña:', True);
  DatabasePage.Values[0] := ExpandConstant('{pf}\PostgreSQL\18\bin');
  DatabasePage.Values[1] := '127.0.0.1';
  DatabasePage.Values[2] := '5432';
  DatabasePage.Values[3] := 'sistema_control_pagos';
  DatabasePage.Values[4] := 'postgres';
  if GetEnv('SCP_PG_BIN') <> '' then DatabasePage.Values[0] := GetEnv('SCP_PG_BIN');
  if GetEnv('SCP_DB_HOST') <> '' then DatabasePage.Values[1] := GetEnv('SCP_DB_HOST');
  if GetEnv('SCP_DB_PORT') <> '' then DatabasePage.Values[2] := GetEnv('SCP_DB_PORT');
  if GetEnv('SCP_DB_NAME') <> '' then DatabasePage.Values[3] := GetEnv('SCP_DB_NAME');
  if GetEnv('SCP_DB_USER') <> '' then DatabasePage.Values[4] := GetEnv('SCP_DB_USER');
  if GetEnv('SCP_DB_PASSWORD') <> '' then DatabasePage.Values[5] := GetEnv('SCP_DB_PASSWORD');

  AdminPage := CreateInputQueryPage(DatabasePage.ID, 'Administrador inicial',
    'Cuenta inicial del sistema', 'Esta cuenta solo se crea si la base de datos aún no tiene un ADMINISTRADOR.');
  AdminPage.Add('Nombres:', False);
  AdminPage.Add('Apellido paterno:', False);
  AdminPage.Add('Apellido materno (opcional):', False);
  AdminPage.Add('Tipo de documento:', False);
  AdminPage.Add('Número de documento:', False);
  AdminPage.Add('Correo:', False);
  AdminPage.Add('Teléfono (opcional):', False);
  AdminPage.Add('Usuario:', False);
  AdminPage.Add('Contraseña:', True);
  AdminPage.Add('Confirmar contraseña:', True);
  AdminPage.Values[3] := 'DNI';
  AdminPage.Values[0] := GetEnv('SETUP_ADMIN_FIRST_NAME');
  AdminPage.Values[1] := GetEnv('SETUP_ADMIN_LAST_NAME_FATHER');
  AdminPage.Values[2] := GetEnv('SETUP_ADMIN_LAST_NAME_MOTHER');
  if GetEnv('SETUP_ADMIN_DOCUMENT_TYPE') <> '' then AdminPage.Values[3] := GetEnv('SETUP_ADMIN_DOCUMENT_TYPE');
  AdminPage.Values[4] := GetEnv('SETUP_ADMIN_DOCUMENT_NUMBER');
  AdminPage.Values[5] := GetEnv('SETUP_ADMIN_EMAIL');
  AdminPage.Values[6] := GetEnv('SETUP_ADMIN_PHONE');
  AdminPage.Values[7] := GetEnv('SETUP_ADMIN_USERNAME');
  AdminPage.Values[8] := GetEnv('SETUP_ADMIN_PASSWORD');
  AdminPage.Values[9] := GetEnv('SETUP_ADMIN_PASSWORD_CONFIRM');
  if AdminPage.Values[9] = '' then AdminPage.Values[9] := AdminPage.Values[8];
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = DatabasePage.ID then begin
    Result := FileExists(AddBackslash(DatabasePage.Values[0]) + 'psql.exe') and
      (DatabasePage.Values[1] <> '') and (DatabasePage.Values[2] <> '') and
      (DatabasePage.Values[3] <> '') and (DatabasePage.Values[4] <> '') and
      (DatabasePage.Values[5] <> '');
    if not Result then MsgBox('Complete los datos y seleccione un directorio PostgreSQL válido.', mbError, MB_OK);
  end;
  if CurPageID = AdminPage.ID then begin
    Result := (AdminPage.Values[0] <> '') and (AdminPage.Values[1] <> '') and
      (AdminPage.Values[3] <> '') and (AdminPage.Values[4] <> '') and
      (AdminPage.Values[5] <> '') and (AdminPage.Values[7] <> '') and
      (Length(AdminPage.Values[8]) >= 10) and (AdminPage.Values[8] = AdminPage.Values[9]);
    if not Result then MsgBox('Complete los datos obligatorios. La contraseña debe tener al menos 10 caracteres, mayúscula, minúscula y número; ambas entradas deben coincidir.', mbError, MB_OK);
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var ResultCode: Integer;
begin
  if FileExists(ExpandConstant('{app}\scripts\Scheduled-Backup.ps1')) and
     FileExists(AddBackslash(DataRootValue) + 'config\backend.env') then begin
    if not RunPowerShell('Scheduled-Backup.ps1', '-ApplicationRoot "' + ExpandConstant('{app}') + '" -DataRoot "' + DataRootValue + '"') then begin
      Result := 'No se pudo crear el respaldo preventivo. La actualización fue cancelada.';
      exit;
    end;
  end;
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop SistemaControlPagosFrontend' + ServiceSuffixValue, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop SistemaControlPagosBackend' + ServiceSuffixValue, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := '';
end;

procedure ClearSensitiveEnvironment;
begin
  SetEnvironmentVariable('SCP_DB_PASSWORD', '');
  SetEnvironmentVariable('SETUP_ADMIN_PASSWORD', '');
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Parameters, Config: string;
begin
  if CurStep = ssPostInstall then begin
    if not RunPowerShell('Test-Ports.ps1', '-BackendPort ' + BackendPortValue + ' -FrontendPort ' + FrontendPortValue + ' -ServiceSuffix "' + ServiceSuffixValue + '"') then
      RaiseException('Los puertos requeridos están ocupados por otra aplicación.');
    SetEnvironmentVariable('SCP_DB_HOST', DatabasePage.Values[1]);
    SetEnvironmentVariable('SCP_DB_PORT', DatabasePage.Values[2]);
    SetEnvironmentVariable('SCP_DB_NAME', DatabasePage.Values[3]);
    SetEnvironmentVariable('SCP_DB_USER', DatabasePage.Values[4]);
    SetEnvironmentVariable('SCP_DB_PASSWORD', DatabasePage.Values[5]);
    SetEnvironmentVariable('SETUP_ADMIN_FIRST_NAME', AdminPage.Values[0]);
    SetEnvironmentVariable('SETUP_ADMIN_LAST_NAME_FATHER', AdminPage.Values[1]);
    SetEnvironmentVariable('SETUP_ADMIN_LAST_NAME_MOTHER', AdminPage.Values[2]);
    SetEnvironmentVariable('SETUP_ADMIN_DOCUMENT_TYPE', AdminPage.Values[3]);
    SetEnvironmentVariable('SETUP_ADMIN_DOCUMENT_NUMBER', AdminPage.Values[4]);
    SetEnvironmentVariable('SETUP_ADMIN_EMAIL', AdminPage.Values[5]);
    SetEnvironmentVariable('SETUP_ADMIN_PHONE', AdminPage.Values[6]);
    SetEnvironmentVariable('SETUP_ADMIN_USERNAME', AdminPage.Values[7]);
    SetEnvironmentVariable('SETUP_ADMIN_PASSWORD', AdminPage.Values[8]);
    Parameters := '-ApplicationRoot "' + ExpandConstant('{app}') + '" -DataRoot "' +
      DataRootValue + '" -PostgreSqlBin "' + DatabasePage.Values[0] + '" -BackendPort ' +
      BackendPortValue + ' -FrontendPort ' + FrontendPortValue;
    if not RunPowerShell('Initialize-Installation.ps1', Parameters) then begin
      ClearSensitiveEnvironment;
      RaiseException('No se pudo inicializar la instalación. Consulte el log del instalador.');
    end;
    ClearSensitiveEnvironment;

    Config := '{' + #13#10 +
      '  "BackendHealthUrl": "http://localhost:' + BackendPortValue + '/health",' + #13#10 +
      '  "FrontendUrl": "http://localhost:' + FrontendPortValue + '/login",' + #13#10 +
      '  "BackendServiceName": "SistemaControlPagosBackend' + ServiceSuffixValue + '",' + #13#10 +
      '  "FrontendServiceName": "SistemaControlPagosFrontend' + ServiceSuffixValue + '",' + #13#10 +
      '  "TimeoutSeconds": 60,' + #13#10 + '  "OpenBrowser": true,' + #13#10 +
      '  "DataRoot": "' + DataRootValue + '"' + #13#10 + '}';
    StringChangeEx(Config, '\', '\\', True);
    SaveStringToFile(ExpandConstant('{app}\launcher.config.json'), Config, False);

    if not RunPowerShell('Install-Services.ps1', '-ApplicationRoot "' + ExpandConstant('{app}') + '" -DataRoot "' + DataRootValue + '" -ServiceSuffix "' + ServiceSuffixValue + '" -FrontendPort ' + FrontendPortValue) then
      RaiseException('No se pudieron instalar los servicios de Windows.');
    if not RunPowerShell('Register-BackupTask.ps1', '-ApplicationRoot "' + ExpandConstant('{app}') + '" -TaskSuffix "' + TaskSuffixValue + '" -BackupTime "' + BackupTimeValue + '"') then
      RaiseException('No se pudo registrar el respaldo programado.');
    SetIniString('Installation', 'DataRoot', DataRootValue, ExpandConstant('{app}\install-state.ini'));
    SetIniString('Installation', 'ServiceSuffix', ServiceSuffixValue, ExpandConstant('{app}\install-state.ini'));
    SetIniString('Installation', 'TaskSuffix', TaskSuffixValue, ExpandConstant('{app}\install-state.ini'));
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var ResultCode: Integer; ServiceSuffix, TaskSuffix: string;
begin
  if CurUninstallStep = usUninstall then begin
    ServiceSuffix := GetIniString('Installation', 'ServiceSuffix', '', ExpandConstant('{app}\install-state.ini'));
    TaskSuffix := GetIniString('Installation', 'TaskSuffix', '', ExpandConstant('{app}\install-state.ini'));
    RunPowerShell('Uninstall-Services.ps1', '-ApplicationRoot "' + ExpandConstant('{app}') + '" -ServiceSuffix "' + ServiceSuffix + '"');
    Exec(ExpandConstant('{sys}\schtasks.exe'), '/Delete /TN SistemaControlPagosBackup' + TaskSuffix + ' /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

[Run]
Filename: "{app}\SistemaControlPagos.exe"; Description: "Abrir {#ProductName}"; Flags: nowait postinstall skipifsilent
