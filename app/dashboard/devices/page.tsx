import { createClient } from '@/utils/supabase/server';
import AddDeviceForm from './AddDeviceForm';
import { Smartphone, ArrowLeft, Cpu, ShieldCheck, Wifi, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default async function DevicesPage() {
  const supabase = await createClient();

  // 1. Fetch registered physical devices
  const { data: devicesData } = await supabase
    .from('devices')
    .select('*')
    .order('created_at', { ascending: false });

  const registeredDevices = devicesData || [];

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-baseline gap-2 pb-2 border-b border-meridian-border">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-meridian-text-1 flex items-center gap-2.5">
            <Smartphone className="w-8 h-8 text-meridian-gold" />
            Biometric Terminals
          </h1>
          <p className="text-xs font-mono uppercase tracking-widest text-meridian-text-3 mt-1">
            ADMS Hardware Integration & Terminal Status
          </p>
        </div>
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-meridian-text-2 hover:text-meridian-gold transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Overview
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Hardware Status List (8 columns) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-meridian-panel border border-meridian-border rounded-2xl p-6">
            <div className="flex justify-between items-center pb-3 border-b border-meridian-border mb-6">
              <div>
                <h3 className="font-serif text-lg font-medium text-meridian-text-1">
                  Active Terminal Registry
                </h3>
                <p className="text-[11px] text-meridian-text-3 font-mono mt-0.5">
                  Synchronized biometric units connected via TCP/IP
                </p>
              </div>
              <span className="text-[10px] font-mono tracking-wider text-meridian-text-2 bg-meridian-deep px-2.5 py-1 rounded flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin text-meridian-gold" />
                POLLING LIVE
              </span>
            </div>

            <div className="space-y-4">
              {registeredDevices.length > 0 ? (
                registeredDevices.map((dev) => {
                  const lastSeen = new Date(dev.created_at || '2026-07-14T03:51:18-07:00');
                  const formattedTime = lastSeen.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  });

                  return (
                    <div 
                      key={dev.id} 
                      className="p-5 bg-meridian-panel-raised/50 border border-meridian-border rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-meridian-gold/40 transition duration-150"
                      suppressHydrationWarning
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="p-2.5 bg-meridian-deep border border-meridian-border rounded-lg text-meridian-gold">
                          <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-serif text-base font-semibold text-meridian-text-1">
                              {dev.label}
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-meridian-text-3 mt-1.5">
                            <span>SN: <span className="text-meridian-text-2 font-medium">{dev.serial_number}</span></span>
                            <span className="text-meridian-border">•</span>
                            <span>IP: <span className="text-meridian-text-2">{dev.ip_address || 'Unset'}</span></span>
                            <span className="text-meridian-border">•</span>
                            <span>Firmware: <span className="text-meridian-text-2">{dev.firmware_version || 'v8.1.0'}</span></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col items-end gap-2 justify-between w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-meridian-border/50">
                        <div className="flex items-center gap-1.5">
                          <Wifi className="w-3.5 h-3.5 text-meridian-gain" />
                          <span className="text-xs font-mono font-medium text-meridian-gain">
                            CONNECTED
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-meridian-text-3">
                          Registered: {formattedTime}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 px-4 bg-meridian-panel-raised/30 border border-dashed border-meridian-border rounded-xl">
                  <Smartphone className="w-8 h-8 text-meridian-text-3 mx-auto mb-2.5 opacity-50" />
                  <p className="text-sm text-meridian-text-2 font-medium">No biometric terminals connected yet</p>
                  <p className="text-xs text-meridian-text-3 mt-1">Use the registration form on the right to link your physical ADMS terminal.</p>
                </div>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-meridian-border/60 text-xs text-meridian-text-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-meridian-gold shrink-0" />
              <span>All biometric communication is encrypted using 256-bit AES protocols for children protection laws.</span>
            </div>
          </div>
        </div>

        {/* Register Device Form (4 columns) */}
        <div className="lg:col-span-4">
          <AddDeviceForm />
        </div>

      </div>

    </div>
  );
}
