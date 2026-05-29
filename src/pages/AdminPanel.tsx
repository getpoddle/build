import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AdminAuth from './AdminAuth';
import AdminDashboard from './AdminDashboard';

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: adminData } = await supabase
          .from('admins')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (adminData) {
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error('Error checking admin auth:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminAuth onAuthSuccess={() => setIsAuthenticated(true)} />;
  }

  return <AdminDashboard />;
}
