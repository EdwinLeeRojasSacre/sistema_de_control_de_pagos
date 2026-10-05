using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SistemaControlPagos.Launcher
{
    internal sealed class LauncherConfig
    {
        public string BackendHealthUrl { get; set; }
        public string FrontendUrl { get; set; }
        public string BackendServiceName { get; set; }
        public string FrontendServiceName { get; set; }
        public int TimeoutSeconds { get; set; }
        public bool OpenBrowser { get; set; }
        public string DataRoot { get; set; }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            try
            {
                var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "launcher.config.json");
                var config = new JavaScriptSerializer().Deserialize<LauncherConfig>(File.ReadAllText(configPath));
                Validate(config);

                if (Environment.GetCommandLineArgs().Length > 1 && Environment.GetCommandLineArgs()[1] == "/backup")
                {
                    RunBackup(config);
                    return;
                }

                if (!IsHealthy(config.BackendHealthUrl)) StartService(config.BackendServiceName);
                if (!IsHealthy(config.FrontendUrl)) StartService(config.FrontendServiceName);

                var deadline = DateTime.UtcNow.AddSeconds(config.TimeoutSeconds > 0 ? config.TimeoutSeconds : 60);
                while (DateTime.UtcNow < deadline)
                {
                    if (IsHealthy(config.BackendHealthUrl) && IsHealthy(config.FrontendUrl))
                    {
                        if (config.OpenBrowser)
                        {
                            Process.Start(new ProcessStartInfo(config.FrontendUrl) { UseShellExecute = true });
                        }
                        return;
                    }
                    Thread.Sleep(1000);
                }

                throw new InvalidOperationException("Los componentes locales no respondieron dentro del tiempo esperado.");
            }
            catch (Exception error)
            {
                MessageBox.Show(
                    "No fue posible iniciar el Sistema de Control de Pagos.\n\n" +
                    error.Message + "\n\nRevise los servicios de Windows o contacte al soporte técnico.",
                    "Sistema de Control de Pagos",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                Environment.ExitCode = 1;
            }
        }

        private static void RunBackup(LauncherConfig config)
        {
            var script = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "scripts", "Scheduled-Backup.ps1");
            var info = new ProcessStartInfo("powershell.exe", "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + script + "\" -ApplicationRoot \"" + AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\') + "\" -DataRoot \"" + config.DataRoot + "\"")
            {
                UseShellExecute = true,
                Verb = "runas",
                WindowStyle = ProcessWindowStyle.Hidden
            };
            using (var process = Process.Start(info))
            {
                process.WaitForExit();
                if (process.ExitCode != 0) throw new InvalidOperationException("No se pudo completar el respaldo.");
            }
            MessageBox.Show("El respaldo finalizó correctamente.", "Sistema de Control de Pagos", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private static void Validate(LauncherConfig config)
        {
            if (config == null || string.IsNullOrWhiteSpace(config.BackendHealthUrl) ||
                string.IsNullOrWhiteSpace(config.FrontendUrl) ||
                string.IsNullOrWhiteSpace(config.BackendServiceName) ||
                string.IsNullOrWhiteSpace(config.FrontendServiceName) || string.IsNullOrWhiteSpace(config.DataRoot))
            {
                throw new InvalidDataException("La configuración local del iniciador no es válida.");
            }
        }

        private static bool IsHealthy(string url)
        {
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(url);
                request.Method = "GET";
                request.Timeout = 2500;
                request.ReadWriteTimeout = 2500;
                request.AllowAutoRedirect = true;
                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    return (int)response.StatusCode >= 200 && (int)response.StatusCode < 400;
                }
            }
            catch { return false; }
        }

        private static void StartService(string serviceName)
        {
            var result = RunSc(serviceName, false);
            if (result == 0 || result == 1056) return;
            RunSc(serviceName, true);
        }

        private static int RunSc(string serviceName, bool elevated)
        {
            var info = new ProcessStartInfo("sc.exe", "start \"" + serviceName.Replace("\"", "") + "\"")
            {
                UseShellExecute = elevated,
                CreateNoWindow = !elevated,
                WindowStyle = ProcessWindowStyle.Hidden,
                Verb = elevated ? "runas" : string.Empty
            };
            using (var process = Process.Start(info))
            {
                process.WaitForExit(15000);
                return process.HasExited ? process.ExitCode : -1;
            }
        }
    }
}
