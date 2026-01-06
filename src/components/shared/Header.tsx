// src/components/common/Header.tsx - CORRIGIDO
import { supabase } from '../../lib/supabase';

interface HeaderProps {
  title: string;
  userEmail?: string;
  storeName?: string;
  profileType?: 'admin' | 'producao' | 'lojas';
}

export default function Header({ title, userEmail, storeName, profileType }: HeaderProps) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const getProfileInfo = () => {
    switch (profileType) {
      case 'admin':
        return { text: 'ADMINISTRATIVO', color: '#8B5CF6', bgColor: '#F3E5F5' };
      case 'producao':
        return { text: 'PRODUÇÃO', color: '#10B981', bgColor: '#E8F5E9' };
      case 'lojas':
        return { text: 'LOJA', color: '#3B82F6', bgColor: '#E3F2FD' };
      default:
        return { text: 'USUÁRIO', color: '#6B7280', bgColor: '#F5F5F5' };
    }
  };

  const profile = getProfileInfo();

  return (
    <header style={{
      backgroundColor: 'white',
      padding: '1rem 2rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '24px' }}>🥗</span>
          <span style={{
            fontSize: '1.25rem',
            fontWeight: '700',
            color: '#FF6B6B'
          }}>
            Sunset Saladas
          </span>
        </div>
        
        <div style={{
          height: '24px',
          width: '1px',
          backgroundColor: '#E5E7EB',
          margin: '0 12px'
        }} />
        
        <div>
          <h1 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#374151',
            margin: 0
          }}>
            {title}
          </h1>
          
          {storeName && (
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              color: '#666'
            }}>
              🏪 {storeName}
            </p>
          )}
          
          {userEmail && (
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '11px',
              color: '#888'
            }}>
              👤 {userEmail}
            </p>
          )}
        </div>
        
        <div style={{
          padding: '4px 12px',
          backgroundColor: profile.bgColor,
          color: profile.color,
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500'
        }}>
          {profile.text}
        </div>
      </div>

      <button
        onClick={handleLogout}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          backgroundColor: '#FEF2F2',
          color: '#DC2626',
          border: '1px solid #FECACA',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'all 0.3s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#FEE2E2';
          e.currentTarget.style.borderColor = '#FCA5A5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#FEF2F2';
          e.currentTarget.style.borderColor = '#FECACA';
        }}
      >
        <span style={{ fontSize: '16px' }}>🚪</span>
        Sair
      </button>
    </header>
  );
}