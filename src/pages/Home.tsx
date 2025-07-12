import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Proxy } from '../lib/supabase';
import { Download, FileText, FileSpreadsheet, Copy, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export const Home: React.FC = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState(15);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setAmount(value);
    }
  };

  const generateProxies = async () => {
    if (!user) return;
    
    if (amount < 1) {
      toast.error('Please enter at least 1 IP');
      return;
    }

    setLoading(true);
    try {
      // Check for available proxies
      const { data: availableProxies, error } = await supabase
        .from('proxies')
        .select('*')
        .eq('is_used', false)
        .limit(amount);

      if (error) throw error;

      if (!availableProxies || availableProxies.length < amount) {
        toast.error(`Not enough IPs available. Only ${availableProxies?.length || 0} IPs available.`);
        setLoading(false);
        return;
      }

      // Check if any of these proxies are being used by others
      const proxyIds = availableProxies.map(p => p.id);
      const { data: updatedProxies } = await supabase
        .from('proxies')
        .select('*')
        .in('id', proxyIds)
        .eq('is_used', false);

      if (!updatedProxies || updatedProxies.length < amount) {
        toast.error('Other users are using these IPs. Please try again.');
        setLoading(false);
        return;
      }

      setProxies(updatedProxies.slice(0, amount));
      toast.success(`${amount} IPs generated successfully`);
    } catch (error) {
      toast.error('Error generating IPs');
      console.error('Error generating proxies:', error);
    }
    setLoading(false);
  };

  const markProxiesAsUsed = async () => {
    if (proxies.length === 0) return;

    try {
      const proxyIds = proxies.map(p => p.id);
      
      // Mark all as used
      const { error: updateError } = await supabase
        .from('proxies')
        .update({
          is_used: true,
          used_by: user?.id,
          used_at: new Date().toISOString()
        })
        .in('id', proxyIds);

      if (updateError) throw updateError;

      // Delete from database
      await supabase.from('proxies').delete().in('id', proxyIds);

      // Log usage
      await supabase.from('usage_logs').insert({
        user_id: user?.id,
        amount: proxies.length
      });

      await fetchTodayUsage();
    } catch (error) {
      console.error('Error marking proxies as used:', error);
    }
  };

  const downloadTXT = async () => {
    if (proxies.length === 0) return;

    try {
      const proxyText = proxies.map(p => p.proxy_string).join('\n');
      const blob = new Blob([proxyText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `proxies_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await markProxiesAsUsed();
      setProxies([]);
      toast.success('TXT file downloaded and IPs removed from database');
    } catch (error) {
      toast.error('Error downloading TXT file');
      console.error('Error downloading TXT:', error);
    }
  };

  const downloadExcel = async () => {
    if (proxies.length === 0) return;

    try {
      // Create workbook with proxy data
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(
        proxies.map(p => [p.proxy_string])
      );

      // Set column width
      const maxLength = Math.max(...proxies.map(p => p.proxy_string.length));
      worksheet['!cols'] = [{ wch: maxLength + 2 }];

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'IP Proxies');

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `proxies_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await markProxiesAsUsed();
      setProxies([]);
      toast.success('Excel file downloaded and IPs removed from database');
    } catch (error) {
      toast.error('Error downloading Excel file');
      console.error('Error downloading Excel:', error);
    }
  };

  const copyAllProxies = async () => {
    if (proxies.length === 0) return;

    try {
      // Check if all proxies are still available
      const proxyIds = proxies.map(p => p.id);
      const { data: currentProxies, error } = await supabase
        .from('proxies')
        .select('*')
        .in('id', proxyIds)
        .eq('is_used', false);

      if (error) throw error;

      if (!currentProxies || currentProxies.length !== proxies.length) {
        toast.error('Some IPs have been used by others. Please generate again.');
        return;
      }

      // Copy all to clipboard
      const allProxies = proxies.map(p => p.proxy_string).join('\n');
      await navigator.clipboard.writeText(allProxies);
      
      toast.success(`${proxies.length} IPs copied to clipboard`);

      await markProxiesAsUsed();
      setProxies([]);
    } catch (error) {
      toast.error('Error copying all IPs');
      console.error('Error copying all proxies:', error);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">IP Proxy Generator</h1>
          
          <div className="flex items-center space-x-4 mb-6">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Number of IPs
              </label>
              <input
                type="number"
                id="amount"
                min="1"
                value={amount}
                onChange={handleAmountChange}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="pt-6 flex space-x-3">
              <button
                onClick={generateProxies}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Generating...</span>
                  </div>
                ) : (
                  'Generate IPs'
                )}
              </button>
            </div>
          </div>
        </div>

        {proxies.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Generated IPs ({proxies.length})
              </h2>
              <div className="flex items-center space-x-3">
                <button
                  onClick={copyAllProxies}
                  className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
                >
                  <Copy size={16} />
                  <span>Copy All</span>
                </button>
                <button
                  onClick={downloadTXT}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                >
                  <FileText size={16} />
                  <span>Download TXT</span>
                </button>
                <button
                  onClick={downloadExcel}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <FileSpreadsheet size={16} />
                  <span>Download Excel</span>
                </button>
              </div>
            </div>
            
            {/* Single box containing all proxies */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="max-h-96 overflow-y-auto">
                <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap break-all">
                  {proxies.map(proxy => proxy.proxy_string).join('\n')}
                </pre>
              </div>
            </div>

            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-yellow-400 mr-2" />
                <p className="text-yellow-700 text-sm">
                  <strong>Warning:</strong> IPs will be deleted from the database after downloading. 
                  Make sure to download the IPs you need.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
