'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Loader2, Magnet, ArrowRight } from 'lucide-react';

interface Membership {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerAvatar: string | null;
}

export default function TeamSelectPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberships = async () => {
      try {
        const res = await fetch('/api/team/memberships');
        if (res.ok) {
          const data = await res.json();
          setMemberships(data);

          // Auto-redirect if only one membership
          if (data.length === 1) {
            selectOwner(data[0].ownerId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch memberships:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMemberships();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectOwner = (ownerId: string) => {
    document.cookie = `ml-team-context=${ownerId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    router.push('/catalog');
  };

  const selectOwnAccount = () => {
    document.cookie = 'ml-team-context=; path=/; max-age=0';
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl mb-4">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Select Account</h1>
        <p className="text-sm text-muted-foreground">
          Choose whose lead magnet catalog you want to view
        </p>
      </div>

      <div className="space-y-3">
        {/* Own account option */}
        <button
          onClick={selectOwnAccount}
          className="flex items-center gap-4 w-full rounded-lg border p-4 hover:border-primary/30 hover:bg-muted/50 transition-colors text-left"
        >
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg text-primary-foreground shrink-0">
            <Magnet size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">My Account</p>
            <p className="text-xs text-muted-foreground">Access your own dashboard</p>
          </div>
          <ArrowRight size={16} className="text-muted-foreground shrink-0" />
        </button>

        {memberships.length > 0 && (
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">Team accounts</span>
            </div>
          </div>
        )}

        {memberships.map((m) => (
          <button
            key={m.id}
            onClick={() => selectOwner(m.ownerId)}
            className="flex items-center gap-4 w-full rounded-lg border p-4 hover:border-primary/30 hover:bg-muted/50 transition-colors text-left"
          >
            {m.ownerAvatar ? (
              <img
                src={m.ownerAvatar}
                alt={m.ownerName}
                className="w-10 h-10 rounded-lg shrink-0"
              />
            ) : (
              <div className="flex items-center justify-center w-10 h-10 bg-violet-500 rounded-lg text-white font-medium text-sm shrink-0">
                {m.ownerName.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{m.ownerName}</p>
              <p className="text-xs text-muted-foreground truncate">{m.ownerEmail}</p>
            </div>
            <ArrowRight size={16} className="text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
