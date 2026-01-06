// src/hooks/useAuthData.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UserData {
  email: string;
  profile: string;
  fullName?: string;
  storeId?: string;
  storeName?: string;
}

export function useAuthData() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuthData();
  }, []);

  const fetchAuthData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Verifica sessão
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw new Error('Erro na sessão: ' + sessionError.message);
      if (!session) throw new Error('Nenhuma sessão encontrada');

      const email = session.user.email || '';

      // 2. Busca dados do usuário na tabela users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          full_name,
          profile_id,
          store_id,
          profiles (username),
          stores (name)
        `)
        .eq('email', email)
        .single();

      if (userError) throw new Error('Usuário não encontrado: ' + userError.message);

      // 3. Extrai os dados
      const userProfile = userData?.profiles?.username || '';
      const storeName = userData?.stores?.name || '';

      setUserData({
        email,
        profile: userProfile,
        fullName: userData.full_name,
        storeId: userData.store_id,
        storeName
      });

    } catch (err: any) {
      console.error('Erro ao buscar dados de autenticação:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchAuthData();
  };

  return { userData, loading, error, refetch };
}