// src/utils/authCheck.ts
import { supabase } from '../lib/supabase';

// Função que ESPERA até a sessão estar realmente carregada
export async function waitForAuth(): Promise<{
  email: string;
  profile: string;
  fullName?: string;
  storeName?: string;
}> {
  return new Promise(async (resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 10; // 5 segundos no total
    
    const checkAuth = async () => {
      attempts++;
      
      try {
        // 1. Verifica sessão NO SUPABASE (não no cache)
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro na sessão:', error);
          throw error;
        }
        
        if (!session || !session.user?.email) {
          console.log(`Tentativa ${attempts}: Sessão ainda não carregada`);
          if (attempts < maxAttempts) {
            setTimeout(checkAuth, 500); // Tenta novamente em 500ms
            return;
          } else {
            throw new Error('Timeout: Sessão não carregada após 5 segundos');
          }
        }
        
        // 2. Sessão encontrada, busca dados do usuário
        const email = session.user.email;
        console.log('✅ Sessão carregada para:', email);
        
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
        
        if (userError) {
          console.error('Erro ao buscar dados do usuário:', userError);
          throw userError;
        }
        
        if (!userData) {
          throw new Error('Usuário não encontrado na tabela users');
        }
        
        const profile = userData?.profiles?.username || '';
        const storeName = userData?.stores?.name || '';
        
        console.log('✅ Dados do usuário carregados:', { email, profile, storeName });
        
        resolve({
          email,
          profile,
          fullName: userData.full_name,
          storeName
        });
        
      } catch (error: any) {
        console.error('Erro no waitForAuth:', error);
        if (attempts < maxAttempts) {
          setTimeout(checkAuth, 500);
        } else {
          reject(error);
        }
      }
    };
    
    // Inicia a verificação
    checkAuth();
  });
}