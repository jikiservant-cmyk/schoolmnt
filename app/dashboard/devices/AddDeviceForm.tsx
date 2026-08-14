'use client';

import { useState, useTransition } from 'react';
import { addDeviceAction } from './actions';
import { Plus, HelpCircle } from 'lucide-react';

export default function AddDeviceForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
       try {
        const res = await addDeviceAction(formData);
        if (res && res.error) {
          setError(res.error);
        } else {
          setSuccess(true);
          form.reset();
          setTimeout(() => setSuccess(false), 3000);
        }
      } catch (err: any) {
        setError(err?.message || 'A network error occurred. Please try again.');
      }
    });
  };

  return (
    <div className="bg-meridian-panel border border-meridian-border rounded-xl p-6 h-fit sticky top-6">
      <div className="pb-3 border-b border-meridian-border mb-4">
        <h3 className="font-serif text-lg font-medium text-meridian-text-1">
          Register ADMS Device
        </h3>
        <p className="text-[10px] font-mono uppercase tracking-wider text-meridian-text-3 mt-1">
          Hardware Provisioning
        </p>
      </div>

      {error && (
        <div className="p-3 mb-4 text-xs font-mono text-meridian-loss bg-meridian-loss/15 rounded-lg border border-meridian-loss/30 animate-fade-in">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 mb-4 text-xs font-mono text-meridian-gold bg-meridian-gold/15 rounded-lg border border-meridian-gold/30 animate-fade-in">
          ADMS device registered successfully.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Serial Number */}
        <div className="space-y-1.5">
          <label htmlFor="serialNumber" className="text-xs font-mono uppercase tracking-wider text-meridian-text-2">
            Device Serial Number (Unique)
          </label>
          <input
            id="serialNumber"
            name="serialNumber"
            type="text"
            required
            placeholder="e.g. ZK-ADMS-9943X"
            disabled={isPending}
            className="w-full px-3 py-2 bg-meridian-panel-raised border border-meridian-border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition-colors disabled:opacity-50 text-meridian-text-1 placeholder-meridian-text-3/60"
          />
        </div>

        {/* Label */}
        <div className="space-y-1.5">
          <label htmlFor="label" className="text-xs font-mono uppercase tracking-wider text-meridian-text-2">
            Placement Label
          </label>
          <input
            id="label"
            name="label"
            type="text"
            placeholder="e.g. Main Gate Entrance"
            disabled={isPending}
            className="w-full px-3 py-2 bg-meridian-panel-raised border border-meridian-border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition-colors disabled:opacity-50 text-meridian-text-1 placeholder-meridian-text-3/60"
          />
        </div>

        {/* IP Address */}
        <div className="space-y-1.5">
          <label htmlFor="ipAddress" className="text-xs font-mono uppercase tracking-wider text-meridian-text-2">
            Static IP / Host Address
          </label>
          <input
            id="ipAddress"
            name="ipAddress"
            type="text"
            placeholder="e.g. 192.168.1.150"
            disabled={isPending}
            className="w-full px-3 py-2 bg-meridian-panel-raised border border-meridian-border text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-meridian-gold focus:border-meridian-gold transition-colors disabled:opacity-50 text-meridian-text-1 placeholder-meridian-text-3/60"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full mt-6 py-2 px-4 text-xs font-mono uppercase tracking-widest text-[#FBFAF3] bg-meridian-gold hover:bg-meridian-gold-dim border border-transparent rounded-lg transition duration-200 disabled:opacity-75 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          {isPending ? 'Provisioning Device...' : 'Register Terminal'}
        </button>
      </form>
    </div>
  );
}
