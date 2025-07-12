import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, User, Proxy, UploadHistory } from '../lib/supabase';
import { Upload, Trash2, Users, Edit2, RotateCcw, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import UploadProgressModal from '../components/UploadProgressModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import * as XLSX from 'xlsx';

export const Admin: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'proxies' | 'upload'>(
    user?.role === 'manager' ? 'proxies' : 'users'
  );
  
  // User management states
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    access_key: '',
    role: 'user' as 'admin' | 'manager' | 'user',
    is_active: true
  });

  // Proxy upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    isOpen: false,
    progress: 0,
    status: 'uploading' as 'uploading' | 'success' | 'error',
    message: '',
    totalProxies: 0,
    processedProxies: 0
  });

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'manager')) {
      // Set default tab based on role
      if (user.role === 'manager') {
        setActiveTab('proxies');
      }
      
      if (user.role === 'admin') {
        fetchUsers();
      }
      fetchUploadHistory();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error loading users');
    }
  };

  const fetchUploadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('upload_history')
        .select(`
          *,
          users!upload_history_uploaded_by_fkey(username)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setUploadHistory(data || []);
    } catch (error) {
      console.error('Error fetching upload history:', error);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingUser) {
        // Update user
        const { error } = await supabase
          .from('users')
          .update(userForm)
          .eq('id', editingUser.id);

        if (error) throw error;
        toast.success('User updated successfully');
      } else {
        // Create new user
        const { error } = await supabase
          .from('users')
          .insert([userForm]);

        if (error) throw error;
        toast.success('User created successfully');
      }

      setShowUserModal(false);
      setEditingUser(null);
      setUserForm({
        username: '',
        access_key: '',
        role: 'user',
        is_active: true
      });
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      if (error.code === '23505') {
        toast.error('Username or access key already exists');
      } else {
        toast.error('Error saving user');
      }
    }
    setLoading(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Error deleting user');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      access_key: user.access_key,
      role: user.role,
      is_active: user.is_active
    });
    setShowUserModal(true);
  };

  const handleFileUpload = async () => {
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    setUploadProgress({
      isOpen: true,
      progress: 0,
      status: 'uploading',
      message: 'Reading file and preparing proxies...',
      totalProxies: 0,
      processedProxies: 0
    });

    try {
      const fileContent = await uploadFile.text();
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        setUploadProgress(prev => ({
          ...prev,
          status: 'error',
          message: 'File is empty or invalid'
        }));
        setTimeout(() => {
          setUploadProgress(prev => ({ ...prev, isOpen: false }));
        }, 3000);
        setUploading(false);
        return;
      }

      // Update progress with total count
      setUploadProgress(prev => ({
        ...prev,
        totalProxies: lines.length,
        progress: 10,
        message: `Found ${lines.length} proxies. Starting upload...`
      }));

      // Simulate progress during processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setUploadProgress(prev => ({
        ...prev,
        progress: 30,
        message: 'Validating proxy format...'
      }));

      await new Promise(resolve => setTimeout(resolve, 300));

      const insertData = lines.map(line => ({ proxy_string: line.trim() }));

      setUploadProgress(prev => ({
        ...prev,
        progress: 50,
        message: 'Uploading to database...'
      }));

      // Insert proxies in batches for better progress tracking
      const batchSize = 100;
      let processedCount = 0;

      for (let i = 0; i < insertData.length; i += batchSize) {
        const batch = insertData.slice(i, i + batchSize);
        
        const { error: batchError } = await supabase
          .from('proxies')
          .insert(batch);

        if (batchError) throw batchError;

        processedCount += batch.length;
        const progressPercent = 50 + (processedCount / insertData.length) * 40; // 50% to 90%
        
        setUploadProgress(prev => ({
          ...prev,
          progress: progressPercent,
          processedProxies: processedCount,
          message: `Uploading... ${processedCount}/${insertData.length} proxies`
        }));

        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      setUploadProgress(prev => ({
        ...prev,
        progress: 95,
        message: 'Finalizing upload...'
      }));

      // Log upload history
      await supabase
        .from('upload_history')
        .insert({
          uploaded_by: user?.id,
          file_name: uploadFile.name,
          position: 'append',
          proxy_count: lines.length
        });

      setUploadProgress(prev => ({
        ...prev,
        progress: 100,
        status: 'success',
        message: `Successfully uploaded ${lines.length} proxies!`
      }));

      // Auto close after success
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, isOpen: false }));
      }, 3000);

      setUploadFile(null);
      fetchUploadHistory();
      
    } catch (error: any) {
      console.error('Error uploading file:', error);
      
      let errorMessage = 'Error uploading file';
      if (error.code === '23505') {
        errorMessage = 'Some proxies already exist in the database';
      }

      setUploadProgress(prev => ({
        ...prev,
        status: 'error',
        message: errorMessage
      }));

      // Auto close after error
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, isOpen: false }));
      }, 5000);
    }
    setUploading(false);
  };

  // Old upload function (keeping for reference, but not used)
  const handleFileUploadOld = async () => {
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    try {
      const fileContent = await uploadFile.text();
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        toast.error('File is empty or invalid');
        setUploading(false);
        return;
      }

      // Insert proxies
      const insertData = lines.map(line => ({ proxy_string: line.trim() }));

      const { error } = await supabase
        .from('proxies')
        .insert(insertData);

      if (error) throw error;

      // Log upload history
      await supabase
        .from('upload_history')
        .insert({
          uploaded_by: user?.id,
          proxy_count: lines.length
        });

      toast.success(`${lines.length} proxies uploaded successfully`);
      setUploadFile(null);
      fetchUploadHistory();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      if (error.code === '23505') {
        toast.error('Some proxies already exist in the database');
      } else {
        toast.error('Error uploading file');
      }
    }
    setUploading(false);
  };

  const handleClearAllProxies = async () => {
    try {
      const { error } = await supabase
        .from('proxies')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;
      toast.success('All proxies deleted successfully');
    } catch (error) {
      console.error('Error clearing proxies:', error);
      toast.error('Error clearing proxies');
    }
  };

  const exportUsersToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(
      users.map(user => ({
        Username: user.username,
        'Access Key': user.access_key,
        Role: user.role,
        'Is Active': user.is_active ? 'Yes' : 'No',
        'Created At': new Date(user.created_at).toLocaleDateString()
      }))
    );

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    XLSX.writeFile(workbook, `users_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Users exported to Excel');
  };

  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="mt-2 text-gray-600">Manage users, proxies, and system settings</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('users')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="inline-block w-4 h-4 mr-2" />
                Users
              </button>
            )}
            <button
              onClick={() => setActiveTab('proxies')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'proxies'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Database className="inline-block w-4 h-4 mr-2" />
              Proxies
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Upload className="inline-block w-4 h-4 mr-2" />
              Upload History
            </button>
          </nav>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && user?.role === 'admin' && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
                <div className="flex space-x-3">
                  <button
                    onClick={exportUsersToExcel}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                  >
                    Export Excel
                  </button>
                  <button
                    onClick={() => setShowUserModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Add User
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Access Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.username}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-mono">{user.access_key}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'admin' 
                            ? 'bg-red-100 text-red-800'
                            : user.role === 'manager'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_active 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Proxies Tab */}
        {activeTab === 'proxies' && (
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Proxies</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select File (TXT format, one proxy per line)
                  </label>
                  <input
                    type="file"
                    accept=".txt"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleFileUpload}
                    disabled={!uploadFile || uploading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {uploading ? 'Uploading...' : 'Upload Proxies'}
                  </button>
                </div>
              </div>
            </div>

            {/* Proxy Management Section */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Proxy Management</h2>
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Database className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-red-800">
                      Danger Zone
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        This action will permanently delete all proxies from the database. 
                        This action cannot be undone.
                      </p>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center space-x-2"
                      >
                        <Trash2 size={16} />
                        <span>Delete All Proxies</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Upload History Tab */}
        {activeTab === 'upload' && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Upload History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploaded By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Proxy Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Upload Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {uploadHistory.map((upload) => (
                    <tr key={upload.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {upload.file_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(upload as any).users?.username || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {upload.proxy_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          upload.position === 'prepend' 
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {upload.position}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(upload.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* User Modal */}
        <Modal
          isOpen={showUserModal}
          onClose={() => {
            setShowUserModal(false);
            setEditingUser(null);
            setUserForm({
              username: '',
              access_key: '',
              role: 'user',
              daily_limit: 500,
              is_active: true
            });
          }}
          title={editingUser ? 'Edit User' : 'Add New User'}
        >
          <form onSubmit={handleUserSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Key
              </label>
              <input
                type="text"
                required
                value={userForm.access_key}
                onChange={(e) => setUserForm({ ...userForm, access_key: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'admin' | 'manager' | 'user' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <input
                type="checkbox"
                id="is_active"
                checked={userForm.is_active}
                onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                Active User
              </label>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Upload Progress Modal */}
        <UploadProgressModal
          isOpen={uploadProgress.isOpen}
          progress={uploadProgress.progress}
          status={uploadProgress.status}
          message={uploadProgress.message}
          totalProxies={uploadProgress.totalProxies}
          processedProxies={uploadProgress.processedProxies}
        />

        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleClearAllProxies}
          title="Delete All Proxies"
          message="This will permanently delete all proxies from the database. This action will immediately affect all users and cannot be undone."
          confirmText="Delete All Proxies"
        />
      </div>
    </div>
  );
};