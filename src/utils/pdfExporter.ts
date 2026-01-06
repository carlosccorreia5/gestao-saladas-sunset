// src/utils/pdfExporter.ts

let jsPDF: any = null;
let autoTable: any = null;

export const loadPDFLibraries = async (): Promise<boolean> => {
  try {
    console.log('🔍 Carregando bibliotecas PDF...');
    
    // Tentar usar do window primeiro (CDN)
    if (window.jspdf && window.jspdf.jsPDF) {
      console.log('✅ Usando jsPDF do window (CDN)');
      jsPDF = window.jspdf.jsPDF;
      
      // IMPORTANTE: autoTable é um plugin, não está em window.jspdf
      // Vamos carregar dinamicamente
      const autoTableModule = await import('jspdf-autotable');
      autoTable = autoTableModule.default;
      return true;
    }
    
    // Fallback: carregar tudo dinamicamente
    console.log('📦 Carregando bibliotecas dinamicamente...');
    const jsPDFModule = await import('jspdf');
    jsPDF = jsPDFModule.default;
    
    const autoTableModule = await import('jspdf-autotable');
    autoTable = autoTableModule.default;
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao carregar bibliotecas PDF:', error);
    return false;
  }
};

export const createPDFDocument = () => {
  if (!jsPDF) {
    throw new Error('jsPDF não carregado');
  }
  return new jsPDF('p', 'mm', 'a4');
};

// CORREÇÃO IMPORTANTE: autoTable deve ser aplicado ao documento
export const addAutoTable = (doc: any, options: any) => {
  if (!autoTable) {
    throw new Error('AutoTable não carregado');
  }
  
  // Aplicar o plugin autoTable ao documento
  if (typeof autoTable === 'function') {
    return autoTable(doc, options);
  } else {
    // Se for o objeto padrão do jspdf-autotable
    return doc.autoTable(options);
  }
};

export const isPDFReady = () => {
  return !!(jsPDF && autoTable);
};

// Função alternativa mais simples
export const exportPDFSimple = async (title: string, headers: string[], data: any[][]) => {
  try {
    const loaded = await loadPDFLibraries();
    if (!loaded) {
      throw new Error('Bibliotecas não carregadas');
    }
    
    const doc = createPDFDocument();
    
    // Adicionar título
    doc.setFontSize(20);
    doc.text(title, 105, 20, { align: 'center' });
    
    // Adicionar tabela
    addAutoTable(doc, {
      startY: 30,
      head: [headers],
      body: data,
      theme: 'grid'
    });
    
    return doc;
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    throw error;
  }
};