// src/utils/pdfExporter.ts

// Declarações de tipo para evitar erros do TypeScript
declare global {
  interface Window {
    jsPDF?: any;
    jspdf?: any;
    autoTable?: any;
  }
}

// Tipos para as bibliotecas
type JSPDFType = any; // Podemos usar any ou tipar mais especificamente se necessário
type AutoTableType = any;

let jsPDF: JSPDFType | null = null;
let autoTable: AutoTableType | null = null;

export const loadPDFLibraries = async (): Promise<boolean> => {
  try {
    console.log('🔍 Carregando bibliotecas PDF...');
    
    // Tentar usar do window primeiro (CDN) - CORRIGIDO: window.jsPDF
    if (typeof window !== 'undefined' && window.jsPDF) {
      console.log('✅ Usando jsPDF do window (CDN)');
      jsPDF = window.jsPDF;
      
      // Tentar carregar autoTable do CDN primeiro
      if (window.autoTable) {
        autoTable = window.autoTable;
      } else {
        // Fallback: carregar dinamicamente
        const autoTableModule = await import('jspdf-autotable');
        autoTable = autoTableModule.default;
      }
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

export const createPDFDocument = (): any => {
  if (!jsPDF) {
    throw new Error('jsPDF não carregado');
  }
  return new jsPDF('p', 'mm', 'a4');
};

// CORREÇÃO IMPORTANTE: autoTable deve ser aplicado ao documento
export const addAutoTable = (doc: any, options: any): any => {
  if (!autoTable) {
    throw new Error('AutoTable não carregado');
  }
  
  // Aplicar o plugin autoTable ao documento
  if (typeof autoTable === 'function') {
    return autoTable(doc, options);
  } else {
    // Se for o objeto padrão do jspdf-autotable v3+
    if (typeof doc.autoTable === 'function') {
      return doc.autoTable(options);
    } else {
      // Fallback para versões mais antigas
      return autoTable(doc, options);
    }
  }
};

export const isPDFReady = (): boolean => {
  return !!(jsPDF && autoTable);
};

// Interface para opções da tabela
interface TableOptions {
  startY?: number;
  head?: string[][];
  body?: any[][];
  theme?: string;
  headStyles?: any;
  columnStyles?: any;
  [key: string]: any;
}

// Função alternativa mais simples
export const exportPDFSimple = async (
  title: string, 
  headers: string[], 
  data: any[][]
): Promise<any> => {
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
    const tableOptions: TableOptions = {
      startY: 30,
      head: [headers],
      body: data,
      theme: 'grid'
    };
    
    addAutoTable(doc, tableOptions);
    
    return doc;
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    throw error;
  }
};

// Função para gerar e salvar PDF diretamente
export const generateAndSavePDF = async (
  title: string,
  content: string,
  fileName = 'documento.pdf'
): Promise<void> => {
  try {
    const loaded = await loadPDFLibraries();
    if (!loaded) {
      throw new Error('Bibliotecas PDF não disponíveis');
    }
    
    const doc = createPDFDocument();
    
    // Configurar o documento
    doc.setFontSize(16);
    doc.text(title, 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    const splitText = doc.splitTextToSize(content, 180);
    doc.text(splitText, 20, 40);
    
    // Salvar o PDF
    doc.save(fileName);
    
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
};

// Função para criar PDF com tabela de dados
export const createTablePDF = async (
  title: string,
  headers: string[],
  data: any[][],
  fileName = 'relatorio.pdf',
  options: TableOptions = {}
): Promise<void> => {
  try {
    const loaded = await loadPDFLibraries();
    if (!loaded) {
      throw new Error('Bibliotecas PDF não disponíveis');
    }
    
    const doc = createPDFDocument();
    
    // Adicionar título
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(title, 105, 20, { align: 'center' });
    
    // Adicionar data
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, 30, { align: 'center' });
    
    // Configurar opções da tabela
    const tableOptions: TableOptions = {
      startY: 40,
      head: [headers],
      body: data,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      ...options
    };
    
    // Adicionar tabela
    addAutoTable(doc, tableOptions);
    
    // Adicionar rodapé
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
    }
    
    // Salvar o PDF
    doc.save(fileName);
    
  } catch (error) {
    console.error('Erro ao criar PDF com tabela:', error);
    throw error;
  }
};