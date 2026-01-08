// src/components/production/ProductionDashboard.tsx - VERSÃO COMPLETA E CORRIGIDA
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Header from '../common/Header';
import { getSaladTypes } from '../../data/saladTypes'; // Removido generateSequenceNumber pois não é usado

// Interfaces
interface SaladType {
  id: string;
  name: string;
  emoji: string;
  color: string;
  sale_price: number;
}

interface Store {
  id: string;
  name: string;
}

interface DailySummary {
  salad_type_id: string;
  salad_name: string;
  salad_emoji: string;
  salad_color: string;
  total_requested: number;
  total_produced: number;
  remaining: number;
}

interface DeliveryItem {
  id: string;
  salad_type_id: string;
  name: string;
  emoji: string;
  quantity: number;
  batch_number: string;
  unit_price: number;
}

interface DeliveryStore {
  store_id: string;
  store_name: string;
  items: DeliveryItem[];
  totalItems: number;
  totalValue: number;
}

interface TodayDelivery {
  id: string;
  delivery_number: string;
  store_id: string;
  store_name: string;
  production_date: string;
  total_items: number;
  total_value: number;
  status: string;
  delivery_items: Array<{
    id: string;
    salad_type_id: string;
    salad_name: string;
    salad_emoji: string;
    quantity: number;
    batch_number: string;
    unit_price: number;
  }>;
}

export default function ProductionDashboard() {
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saladTypes, setSaladTypes] = useState<SaladType[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [userDbId, setUserDbId] = useState<string>('');
  
  // Dashboard: Total por tipo de salada
  const [dailySummary, setDailySummary] = useState<DailySummary[]>([]);
  
  // Sistema de envios
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedSaladType, setSelectedSaladType] = useState<string>('');
  const [deliveryQuantity, setDeliveryQuantity] = useState(1);
  const [batchNumber, setBatchNumber] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  
  // Lista de envios do dia
  const [deliveryStores, setDeliveryStores] = useState<DeliveryStore[]>([]);
  
  // Envios já realizados hoje
  const [todayDeliveries, setTodayDeliveries] = useState<TodayDelivery[]>([]);
  const [lastDeliveryNumber, setLastDeliveryNumber] = useState(0);

  useEffect(() => {
    initDashboard();
  }, []);

  const initDashboard = async () => {
    console.log('🚀 Iniciando dashboard de produção...');
    
    try {
      // 1. Verificar sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login/producao';
        return;
      }
      setUserEmail(session.user.email || '');
      
      // 2. Buscar ID do usuário no banco
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();
      
      if (userData) {
        setUserDbId(userData.id);
      }
      
      // 3. Buscar tipos de salada
      const saladTypesData = await getSaladTypes();
      setSaladTypes(saladTypesData);
      if (saladTypesData.length > 0) {
        setSelectedSaladType(saladTypesData[0].id);
      }
      
      // 4. Buscar lojas - CORREÇÃO: Extrair .data e tratar erro
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('id, name')
        .order('name');
      
      if (storesError) {
        console.error('Erro ao buscar lojas:', storesError);
        setStores([]);
      } else {
        setStores(storesData || []);
        if (storesData && storesData.length > 0) {
          setSelectedStore(storesData[0].id);
        }
      }
      
      // 5. Buscar resumo do dashboard
      await fetchDailySummary();
      
      // 6. Buscar envios já realizados hoje
      await fetchTodayDeliveries();
      
      // 7. Gerar número de lote padrão (data atual)
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setBatchNumber(`LOTE-${year}${month}${day}`);
      
      // 8. Buscar último número de entrega
      await fetchLastDeliveryNumber();
      
    } catch (error) {
      console.error('Erro ao inicializar:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailySummary = async () => {
    try {
      // Usar a view que criamos
      const { data: dashboardData, error } = await supabase
        .from('vw_production_dashboard')
        .select('*');
      
      if (error) {
        console.error('Erro ao buscar dashboard:', error);
        // Fallback: calcular manualmente
        await calculateDailySummaryManually();
        return;
      }
      
      if (dashboardData) {
        setDailySummary(dashboardData);
      }
      
    } catch (error) {
      console.error('Erro ao buscar resumo:', error);
      await calculateDailySummaryManually();
    }
  };

  const calculateDailySummaryManually = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Buscar todos os tipos de salada
      const { data: allSalads, error: saladsError } = await supabase
        .from('salad_types')
        .select('id, name, emoji, color, sale_price');
      
      if (saladsError) {
        console.error('Erro ao buscar tipos de salada:', saladsError);
        return;
      }
      
      if (!allSalads) return;
      
      const summary: DailySummary[] = [];
      
      for (const salad of allSalads) {
        // Primeiro buscar IDs dos shipments para hoje
        const { data: shipments, error: shipmentsError } = await supabase
          .from('production_shipments')
          .select('id')
          .eq('status', 'pending')
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`);
        
        if (shipmentsError) {
          console.error('Erro ao buscar shipments:', shipmentsError);
          continue;
        }
        
        const shipmentIds = shipments?.map(s => s.id) || [];
        
        // Total solicitado hoje - CORREÇÃO: passar array de IDs em vez de query
        const { data: requestedData, error: requestedError } = shipmentIds.length > 0 
          ? await supabase
              .from('production_items')
              .select('quantity')
              .eq('salad_type_id', salad.id)
              .in('shipment_id', shipmentIds)
          : { data: null, error: null };
        
        if (requestedError) {
          console.error('Erro ao buscar itens solicitados:', requestedError);
        }
        
        const totalRequested = requestedData?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        
        // Buscar IDs dos deliveries para hoje
        const { data: deliveries, error: deliveriesError } = await supabase
          .from('production_deliveries')
          .select('id')
          .eq('production_date', today);
        
        if (deliveriesError) {
          console.error('Erro ao buscar deliveries:', deliveriesError);
          continue;
        }
        
        const deliveryIds = deliveries?.map(d => d.id) || [];
        
        // Total produzido hoje - CORREÇÃO: passar array de IDs em vez de query
        const { data: producedData, error: producedError } = deliveryIds.length > 0
          ? await supabase
              .from('delivery_items')
              .select('quantity')
              .eq('salad_type_id', salad.id)
              .in('delivery_id', deliveryIds)
          : { data: null, error: null };
        
        if (producedError) {
          console.error('Erro ao buscar itens produzidos:', producedError);
        }
        
        const totalProduced = producedData?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        
        summary.push({
          salad_type_id: salad.id,
          salad_name: salad.name,
          salad_emoji: salad.emoji || '🥗',
          salad_color: salad.color || '#4CAF50',
          total_requested: totalRequested,
          total_produced: totalProduced,
          remaining: totalRequested - totalProduced
        });
      }
      
      setDailySummary(summary.sort((a, b) => b.remaining - a.remaining));
      
    } catch (error) {
      console.error('Erro no cálculo manual:', error);
    }
  };

  const fetchTodayDeliveries = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Buscar entregas do dia
      const { data: deliveries, error } = await supabase
        .from('production_deliveries')
        .select(`
          id,
          delivery_number,
          store_id,
          production_date,
          total_items,
          total_value,
          status,
          notes,
          created_at,
          stores!inner(name)
        `)
        .eq('production_date', today)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar entregas:', error);
        return;
      }
      
      if (deliveries) {
        // Para cada entrega, buscar seus itens
        const deliveriesWithItems: TodayDelivery[] = [];
        
        for (const delivery of deliveries) {
          const { data: items, error: itemsError } = await supabase
            .from('delivery_items')
            .select(`
              id,
              salad_type_id,
              quantity,
              batch_number,
              unit_price,
              salad_types!inner(name, emoji)
            `)
            .eq('delivery_id', delivery.id);
          
          if (itemsError) {
            console.error('Erro ao buscar itens da entrega:', itemsError);
            continue;
          }
          
          deliveriesWithItems.push({
            id: delivery.id,
            delivery_number: delivery.delivery_number,
            store_id: delivery.store_id,
            store_name: delivery.stores?.name || 'Loja',
            production_date: delivery.production_date,
            total_items: delivery.total_items,
            total_value: delivery.total_value,
            status: delivery.status,
            delivery_items: items?.map(item => ({
              id: item.id,
              salad_type_id: item.salad_type_id,
              salad_name: item.salad_types?.name || 'Salada',
              salad_emoji: item.salad_types?.emoji || '🥗',
              quantity: item.quantity,
              batch_number: item.batch_number,
              unit_price: item.unit_price
            })) || []
          });
        }
        
        setTodayDeliveries(deliveriesWithItems);
        
        // Organizar por loja para a lista de envios (opcional)
        organizeDeliveryStores(deliveriesWithItems);
      }
    } catch (error) {
      console.error('Erro ao buscar entregas:', error);
    }
  };

  const organizeDeliveryStores = (deliveries: TodayDelivery[]) => {
    const storeMap = new Map<string, DeliveryStore>();
    
    deliveries.forEach(delivery => {
      if (!storeMap.has(delivery.store_id)) {
        storeMap.set(delivery.store_id, {
          store_id: delivery.store_id,
          store_name: delivery.store_name,
          items: [],
          totalItems: 0,
          totalValue: 0
        });
      }
      
      const storeData = storeMap.get(delivery.store_id)!;
      
      delivery.delivery_items.forEach(item => {
        storeData.items.push({
          id: item.id,
          salad_type_id: item.salad_type_id,
          name: item.salad_name,
          emoji: item.salad_emoji,
          quantity: item.quantity,
          batch_number: item.batch_number,
          unit_price: item.unit_price
        });
        storeData.totalItems += item.quantity;
        storeData.totalValue += item.quantity * item.unit_price;
      });
    });
    
    setDeliveryStores(Array.from(storeMap.values()));
  };

  const fetchLastDeliveryNumber = async () => {
    try {
      const { data: lastDelivery, error } = await supabase
        .from('production_deliveries')
        .select('delivery_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Erro ao buscar número de entrega:', error);
        return;
      }
      
      if (lastDelivery?.delivery_number) {
        // Extrair número da sequência (últimos 4 dígitos)
        const match = lastDelivery.delivery_number.match(/(\d{4})$/);
        if (match) {
          setLastDeliveryNumber(parseInt(match[1]));
        }
      }
    } catch (error) {
      console.error('Erro ao buscar número de entrega:', error);
    }
  };

  // ========== FUNÇÕES DE ENVIO ==========
  const addToDeliveryStore = () => {
    const salad = saladTypes.find(s => s.id === selectedSaladType);
    const store = stores.find(s => s.id === selectedStore);
    
    if (!salad || !store) {
      alert('Selecione uma loja e um tipo de salada!');
      return;
    }
    
    // Verificar se esta loja já tem itens na lista
    const existingStoreIndex = deliveryStores.findIndex(s => s.store_id === selectedStore);
    
    const newItem: DeliveryItem = {
      id: Date.now().toString(), // ID temporário
      salad_type_id: selectedSaladType,
      name: salad.name,
      emoji: salad.emoji || '🥗',
      quantity: deliveryQuantity,
      batch_number: batchNumber,
      unit_price: salad.sale_price
    };
    
    if (existingStoreIndex >= 0) {
      // Adicionar à loja existente
      const updatedStores = [...deliveryStores];
      updatedStores[existingStoreIndex] = {
        ...updatedStores[existingStoreIndex],
        items: [...updatedStores[existingStoreIndex].items, newItem],
        totalItems: updatedStores[existingStoreIndex].totalItems + deliveryQuantity,
        totalValue: updatedStores[existingStoreIndex].totalValue + (deliveryQuantity * salad.sale_price)
      };
      setDeliveryStores(updatedStores);
    } else {
      // Criar nova loja na lista
      const newStore: DeliveryStore = {
        store_id: selectedStore,
        store_name: store.name,
        items: [newItem],
        totalItems: deliveryQuantity,
        totalValue: deliveryQuantity * salad.sale_price
      };
      setDeliveryStores([...deliveryStores, newStore]);
    }
    
    // Resetar campos
    setDeliveryQuantity(1);
  };

  const removeDeliveryItem = (storeId: string, itemId: string) => {
    const updatedStores = deliveryStores.map(store => {
      if (store.store_id === storeId) {
        const itemToRemove = store.items.find(item => item.id === itemId);
        if (!itemToRemove) return store;
        
        const updatedItems = store.items.filter(item => item.id !== itemId);
        return {
          ...store,
          items: updatedItems,
          totalItems: store.totalItems - itemToRemove.quantity,
          totalValue: store.totalValue - (itemToRemove.quantity * itemToRemove.unit_price)
        };
      }
      return store;
    }).filter(store => store.items.length > 0); // Remover loja se ficar sem itens
    
    setDeliveryStores(updatedStores);
  };

  const submitDeliveries = async () => {
    if (deliveryStores.length === 0) {
      alert('Adicione pelo menos um item para envio!');
      return;
    }

    try {
      const productionDate = new Date().toISOString().split('T')[0];
      let deliveryCounter = lastDeliveryNumber;
      
      // Para cada loja, criar um envio
      for (const store of deliveryStores) {
        // Verificar se já existe envio para esta loja hoje
        const existingDelivery = todayDeliveries.find(
          d => d.store_id === store.store_id && d.production_date === productionDate
        );
        
        if (existingDelivery) {
          const confirm = window.confirm(
            `⚠️ A loja ${store.store_name} já tem um envio registrado hoje.\n` +
            `Deseja ADICIONAR estes itens ao envio existente?`
          );
          
          if (!confirm) continue;
          
          // Atualizar envio existente
          await updateExistingDelivery(existingDelivery.id, store);
        } else {
          // Criar novo envio
          deliveryCounter++;
          await createNewDelivery(store, productionDate, deliveryCounter);
        }
      }
      
      alert('✅ Envios registrados com sucesso!');
      
      // Limpar e atualizar
      setDeliveryStores([]);
      setShowDeliveryModal(false);
      setDeliveryNotes('');
      
      // Atualizar dados
      await fetchDailySummary();
      await fetchTodayDeliveries();
      setLastDeliveryNumber(deliveryCounter);
      
    } catch (error: any) {
      console.error('❌ Erro ao enviar produção:', error);
      alert(`Erro ao enviar produção:\n${error.message}`);
    }
  };

  const createNewDelivery = async (store: DeliveryStore, productionDate: string, sequenceNumber: number) => {
    try {
      // Gerar número de entrega
      const deliveryNumber = `ENT-${productionDate.replace(/-/g, '')}-${sequenceNumber.toString().padStart(4, '0')}`;
      
      // 1. Criar envio principal
      const { data: delivery, error: deliveryError } = await supabase
        .from('production_deliveries')
        .insert({
          delivery_number: deliveryNumber,
          store_id: store.store_id,
          production_date: productionDate,
          total_items: store.totalItems,
          total_value: store.totalValue,
          notes: deliveryNotes,
          status: 'delivered',
          created_by: userDbId
        })
        .select()
        .single();
      
      if (deliveryError) throw deliveryError;
      
      // 2. Criar itens do envio
      for (const item of store.items) {
        const { error: itemError } = await supabase
          .from('delivery_items')
          .insert({
            delivery_id: delivery.id,
            salad_type_id: item.salad_type_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            batch_number: item.batch_number
          });
        
        if (itemError) {
          console.error('Erro ao salvar item:', itemError);
          // Continuar com outros itens mesmo se um falhar
        }
      }
      
      console.log(`✅ Envio criado para ${store.store_name}: ${deliveryNumber}`);
      
    } catch (error) {
      console.error(`Erro ao criar envio para ${store.store_name}:`, error);
      throw error;
    }
  };

  const updateExistingDelivery = async (deliveryId: string, store: DeliveryStore) => {
    try {
      // Buscar envio existente para atualizar totais
      const { data: existingDelivery, error: fetchError } = await supabase
        .from('production_deliveries')
        .select('total_items, total_value')
        .eq('id', deliveryId)
        .single();
      
      if (fetchError) {
        console.error('Erro ao buscar envio existente:', fetchError);
        throw fetchError;
      }
      
      if (!existingDelivery) {
        throw new Error('Envio não encontrado');
      }
      
      const newTotalItems = existingDelivery.total_items + store.totalItems;
      const newTotalValue = existingDelivery.total_value + store.totalValue;
      
      // Atualizar totais do envio
      const { error: updateError } = await supabase
        .from('production_deliveries')
        .update({
          total_items: newTotalItems,
          total_value: newTotalValue
        })
        .eq('id', deliveryId);
      
      if (updateError) throw updateError;
      
      // Adicionar novos itens
      for (const item of store.items) {
        const { error: insertError } = await supabase
          .from('delivery_items')
          .insert({
            delivery_id: deliveryId,
            salad_type_id: item.salad_type_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            batch_number: item.batch_number
          });
        
        if (insertError) {
          console.error('Erro ao inserir item:', insertError);
        }
      }
      
      console.log(`✅ Itens adicionados ao envio existente da loja ${store.store_name}`);
      
    } catch (error) {
      console.error(`Erro ao atualizar envio:`, error);
      throw error;
    }
  };

  // Validação do formato do lote (removida declaração não usada)
  // Esta função existe mas não é chamada no código, então o TypeScript reclamou
  // Mantemos comentada para referência se precisar no futuro
  /*
  const _validateBatchNumber = (batch: string) => {
    if (!batch) return false;
    
    // Formato básico: LOTE-YYYYMMDD
    const pattern = /^LOTE-\d{8}$/;
    if (!pattern.test(batch)) {
      alert('❌ Formato do lote inválido! Use: LOTE-AAAAMMDD\nEx: LOTE-20240115');
      return false;
    }
    
    return true;
  };
  */

  // ========== RENDERIZAÇÃO ==========
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ 
          fontSize: '28px', 
          fontWeight: 'bold',
          color: '#FF9800',
          textAlign: 'center'
        }}>
          🏭 Sunset Saladas - Produção
        </div>
        <div style={{ 
          fontSize: '18px', 
          color: '#666',
          textAlign: 'center'
        }}>
          Carregando dashboard de produção...
        </div>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid #e0e0e0',
          borderTop: '5px solid #FF9800',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <Header 
        title="Dashboard de Produção"
        userEmail={userEmail}
        profileType="producao"
      />
      
      <main style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* ========== CARD PRINCIPAL: ENVIAR PRODUÇÃO ========== */}
        <div style={{
          padding: '35px',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.08)',
          border: '2px solid #FF9800',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          textAlign: 'center',
          marginBottom: '40px'
        }}
          onClick={() => setShowDeliveryModal(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(255, 152, 0, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.08)';
          }}
        >
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🚚</div>
          <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', color: '#EF6C00' }}>
            Enviar Produção para Lojas
          </h2>
          <p style={{ color: '#666', fontSize: '16px', lineHeight: '1.5', marginBottom: '25px' }}>
            Registre o que foi produzido e enviado para cada loja hoje.
          </p>
          <div style={{
            padding: '12px 25px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'inline-block'
          }}>
            + Registrar Envio
          </div>
        </div>

        {/* ========== DASHBOARD: RESUMO DE PRODUÇÃO ========== */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '30px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          marginBottom: '40px'
        }}>
          <h2 style={{ 
            marginTop: 0, 
            color: '#333', 
            fontSize: '22px', 
            marginBottom: '25px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            📊 Resumo da Produção - Hoje
          </h2>
          
          {dailySummary.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              Nenhum pedido pendente para hoje.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {dailySummary.map((item) => (
                <div key={item.salad_type_id} style={{
                  padding: '20px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '12px',
                  borderLeft: `5px solid ${item.salad_color || '#FF9800'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                    <span style={{ fontSize: '28px' }}>{item.salad_emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{item.salad_name}</div>
                      <div style={{ fontSize: '14px', color: '#666' }}>Status da produção</div>
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '15px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Solicitadas</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
                        {item.total_requested}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Produzidas</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
                        {item.total_produced}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    marginTop: '15px',
                    padding: '10px',
                    backgroundColor: item.remaining > 0 ? '#FFF3E0' : '#E8F5E9',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      {item.remaining > 0 ? 'A produzir:' : 'Produção completa!'}
                    </div>
                    <div style={{ 
                      fontSize: '20px', 
                      fontWeight: 'bold',
                      color: item.remaining > 0 ? '#FF9800' : '#4CAF50'
                    }}>
                      {item.remaining} unidades
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========== ENVIOS REALIZADOS HOJE ========== */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '30px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ 
            marginTop: 0, 
            color: '#333', 
            fontSize: '22px', 
            marginBottom: '25px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            📦 Envios Realizados Hoje ({todayDeliveries.length})
          </h2>
          
          {todayDeliveries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              Nenhum envio registrado ainda hoje.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {todayDeliveries.map((delivery) => (
                <div key={delivery.id} style={{
                  padding: '25px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '12px',
                  borderLeft: `5px solid #4CAF50`
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '15px',
                    flexWrap: 'wrap',
                    gap: '15px'
                  }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
                        {delivery.store_name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                        {delivery.delivery_number} • Produção: {delivery.production_date}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
                        {delivery.total_items} un.
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        R$ {delivery.total_value?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  </div>
                  
                  {delivery.delivery_items.length > 0 && (
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '15px',
                      marginTop: '15px'
                    }}>
                      {delivery.delivery_items.map((item) => (
                        <div key={item.id} style={{
                          padding: '15px',
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          border: '1px solid #eee'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '20px' }}>{item.salad_emoji}</span>
                            <div style={{ fontWeight: 'bold' }}>{item.salad_name}</div>
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>
                            {item.quantity} un. • Lote: {item.batch_number}
                          </div>
                          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                            R$ {item.unit_price?.toFixed(2)}/un
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========== MODAL: REGISTRAR ENVIO ========== */}
        {showDeliveryModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '40px',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '24px', color: '#EF6C00' }}>🚚 Registrar Envio de Produção</h2>
                <button
                  onClick={() => setShowDeliveryModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Formulário de adição */}
              <div style={{
                padding: '25px',
                backgroundColor: '#FFF3E0',
                borderRadius: '12px',
                marginBottom: '30px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      Loja Destino
                    </label>
                    <select
                      value={selectedStore}
                      onChange={(e) => setSelectedStore(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '16px',
                        backgroundColor: todayDeliveries.some(d => d.store_id === selectedStore) ? '#FFF8E1' : 'white'
                      }}
                    >
                      {stores.map(store => {
                        const hasDeliveryToday = todayDeliveries.some(d => d.store_id === store.id);
                        return (
                          <option 
                            key={store.id} 
                            value={store.id}
                            style={{ 
                              backgroundColor: hasDeliveryToday ? '#FFF8E1' : 'white',
                              color: hasDeliveryToday ? '#FF9800' : '#000'
                            }}
                          >
                            {store.name} {hasDeliveryToday ? ' (✔️ Já enviado hoje)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {todayDeliveries.some(d => d.store_id === selectedStore) && (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '8px',
                        backgroundColor: '#FFF8E1',
                        borderRadius: '6px',
                        fontSize: '14px',
                        color: '#FF9800'
                      }}>
                        ⚠️ Esta loja já recebeu envio hoje. Novos itens serão adicionados.
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      Tipo de Salada
                    </label>
                    <select
                      value={selectedSaladType}
                      onChange={(e) => setSelectedSaladType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    >
                      {saladTypes.map(salad => (
                        <option key={salad.id} value={salad.id}>
                          {salad.emoji} {salad.name} (R$ {salad.sale_price.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      Quantidade
                    </label>
                    <input
                      type="number"
                      value={deliveryQuantity}
                      onChange={(e) => setDeliveryQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                      Número do Lote
                    </label>
                    <input
                      type="text"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      placeholder="Ex: LOTE-20240115"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#555' }}>
                    Observações (opcional)
                  </label>
                  <textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Observações sobre o envio..."
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '16px',
                      minHeight: '80px',
                      resize: 'vertical'
                    }}
                  />
                </div>
                <button
                  onClick={addToDeliveryStore}
                  style={{
                    width: '100%',
                    padding: '15px',
                    backgroundColor: '#FF9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ➕ Adicionar à Lista de Envio
                </button>
              </div>

              {/* Lista de envios por loja */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '18px', color: '#333', marginBottom: '15px' }}>
                  Envios a Registrar ({deliveryStores.length} loja{deliveryStores.length !== 1 ? 's' : ''})
                </h3>
                
                {deliveryStores.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#999', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
                    Nenhum item adicionado ainda.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {deliveryStores.map(store => {
                      const storeHasDeliveryToday = todayDeliveries.some(d => d.store_id === store.store_id);
                      return (
                        <div key={store.store_id} style={{
                          padding: '20px',
                          backgroundColor: storeHasDeliveryToday ? '#FFF8E1' : '#f9f9f9',
                          borderRadius: '12px',
                          borderLeft: `5px solid ${storeHasDeliveryToday ? '#FFB74D' : '#FF9800'}`
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'flex-start',
                            marginBottom: '15px'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                <div style={{ 
                                  fontWeight: 'bold', 
                                  fontSize: '18px',
                                  color: storeHasDeliveryToday ? '#FF9800' : '#333'
                                }}>
                                  {store.store_name}
                                </div>
                                {storeHasDeliveryToday && (
                                  <span style={{
                                    padding: '4px 10px',
                                    backgroundColor: '#FFECB3',
                                    color: '#FF9800',
                                    borderRadius: '20px',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                  }}>
                                    ✔️ Já tem envio hoje
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '14px', color: '#666' }}>
                                Total: {store.totalItems} unidade{store.totalItems !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#EF6C00' }}>
                                R$ {store.totalValue.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {store.items.map(item => (
                              <div key={item.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '15px',
                                backgroundColor: 'white',
                                borderRadius: '8px',
                                border: '1px solid #eee'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                  <span style={{ fontSize: '24px' }}>{item.emoji}</span>
                                  <div>
                                    <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                                    <div style={{ fontSize: '14px', color: '#666', marginTop: '2px' }}>
                                      {item.quantity} un. • Lote: {item.batch_number}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                                    R$ {item.unit_price.toFixed(2)}/un
                                  </div>
                                  <button
                                    onClick={() => removeDeliveryItem(store.store_id, item.id)}
                                    style={{
                                      padding: '8px 12px',
                                      backgroundColor: '#ffebee',
                                      color: '#f44336',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '14px'
                                    }}
                                  >
                                    Remover
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Total e botão concluir */}
              {deliveryStores.length > 0 && (
                <div style={{
                  padding: '20px',
                  backgroundColor: '#FFF3E0',
                  borderRadius: '12px',
                  marginBottom: '25px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      Total de Itens:
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#EF6C00' }}>
                      {deliveryStores.reduce((sum, store) => sum + store.totalItems, 0)} unidades
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      Valor Total:
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#EF6C00' }}>
                      R$ {deliveryStores.reduce((sum, store) => sum + store.totalValue, 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                    Esta ação registrará o envio para {deliveryStores.length} loja{deliveryStores.length !== 1 ? 's' : ''}.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '15px' }}>
                <button
                  onClick={() => {
                    setShowDeliveryModal(false);
                    setDeliveryStores([]);
                    setDeliveryNotes('');
                  }}
                  style={{
                    flex: 1,
                    padding: '15px',
                    backgroundColor: '#f5f5f5',
                    color: '#666',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={submitDeliveries}
                  disabled={deliveryStores.length === 0}
                  style={{
                    flex: 2,
                    padding: '15px',
                    backgroundColor: deliveryStores.length === 0 ? '#ccc' : '#FF9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: deliveryStores.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  ✅ Confirmar Todos os Envios
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}