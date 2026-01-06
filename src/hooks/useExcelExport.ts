import { useState, useCallback } from 'react';

export const useExcelExport = () => {
  const [isLoading, setIsLoading] = useState(false);

  const exportToExcel = useCallback(async (data: any[], fileName: string, sheetName = 'Relatório') => {
    setIsLoading(true);
    
    try {
      // Carregamento dinâmico das bibliotecas
      const XLSX = await import('xlsx');
      const { saveAs } = await import('file-saver');

      if (!data || data.length === 0) {
        throw new Error('Nenhum dado para exportar');
      }

      // Criar worksheet
      const ws = XLSX.utils.json_to_sheet(data);
      
      // Criar workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      
      // Gerar buffer Excel
      const excelBuffer = XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array' 
      });
      
      // Criar blob e salvar
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      saveAs(blob, fileName);
      
      return true;
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exportMultipleSheets = useCallback(async (
    sheets: Array<{ data: any[]; sheetName: string }>,
    fileName: string
  ) => {
    setIsLoading(true);
    
    try {
      const XLSX = await import('xlsx');
      const { saveAs } = await import('file-saver');

      const wb = XLSX.utils.book_new();

      sheets.forEach((sheet, index) => {
        if (sheet.data && sheet.data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(sheet.data);
          XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName || `Sheet${index + 1}`);
        }
      });

      const excelBuffer = XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array' 
      });
      
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      saveAs(blob, fileName);
      
      return true;
    } catch (error) {
      console.error('Erro ao exportar múltiplas abas:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    exportToExcel,
    exportMultipleSheets,
    isLoading
  };
};