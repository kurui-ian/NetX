using System;
using System.Runtime.InteropServices;

namespace NetX {
    class Program {
        [DllImport("wlanapi.dll")]
        public static extern int WlanOpenHandle(uint dwClientVersion, IntPtr pReserved, out uint pdwNegotiatedVersion, out IntPtr phClientHandle);

        [DllImport("wlanapi.dll")]
        public static extern int WlanCloseHandle(IntPtr hClientHandle, IntPtr pReserved);

        [DllImport("wlanapi.dll")]
        public static extern int WlanEnumInterfaces(IntPtr hClientHandle, IntPtr pReserved, out IntPtr ppInterfaceList);

        [DllImport("wlanapi.dll")]
        public static extern int WlanScan(IntPtr hClientHandle, ref Guid pInterfaceGuid, IntPtr pDot11Ssid, IntPtr pIeData, IntPtr pReserved);

        [DllImport("wlanapi.dll")]
        public static extern void WlanFreeMemory(IntPtr pMemory);

        static int Main() {
            IntPtr hClient = IntPtr.Zero;
            uint negVersion = 0;
            int res = WlanOpenHandle(2, IntPtr.Zero, out negVersion, out hClient);
            if (res != 0) return 1;

            try {
                IntPtr pList = IntPtr.Zero;
                res = WlanEnumInterfaces(hClient, IntPtr.Zero, out pList);
                if (res != 0 || pList == IntPtr.Zero) return 2;

                try {
                    uint count = (uint)Marshal.ReadInt32(pList);
                    if (count == 0) return 3;

                    for (int i = 0; i < count; i++) {
                        long offset = 8 + (long)i * 532;
                        byte[] guidBytes = new byte[16];
                        Marshal.Copy(new IntPtr(pList.ToInt64() + offset), guidBytes, 0, 16);
                        Guid guid = new Guid(guidBytes);
                        WlanScan(hClient, ref guid, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
                    }
                    Console.WriteLine("SCAN_INITIATED");
                    return 0;
                } finally {
                    WlanFreeMemory(pList);
                }
            } finally {
                WlanCloseHandle(hClient, IntPtr.Zero);
            }
        }
    }
}
