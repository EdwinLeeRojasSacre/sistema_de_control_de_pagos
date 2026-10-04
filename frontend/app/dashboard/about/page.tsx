'use client';

import { useEffect, useState } from 'react';
import { SupportPanel } from '@/components/support/support-panel';
import { getPublicSupport, type PublicSupport } from '@/services/support.service';

export default function AboutPage() {
  const [support, setSupport] = useState<PublicSupport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getPublicSupport().then(setSupport).catch(() => setSupport(null)).finally(() => setLoading(false));
  }, []);

  return <div className="mx-auto max-w-2xl"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><SupportPanel support={support} loading={loading}/></div></div>;
}
