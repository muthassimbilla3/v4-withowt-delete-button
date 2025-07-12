import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, User, UsageLog } from '../lib/supabase';
import { Users, Database, Activity, TrendingUp, Calendar, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalProxies: number;
  usedProxies: number;
  todayUsage: number;
  weeklyUsage: number;
}

interface UserUsage {
  user: User;
  todayUsage: number;
  weeklyUsage: number;
  monthlyUsage: number;
}

export const Status: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalProxies: 0,
    usedProxies: 0,
    todayUsage: 0,
    weeklyUsage: 0
  });
  const [userUsages, setUserUsages] = useState<UserUsage[]>([]);
  const [recentLogs, setRecentLogs] = useState<(UsageLog & { users: { username: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'manager')) {
      fetchSystemStats();
      fetchUserUsages();
      fetchRecentLogs();
    }
  }, [user]);

  const fetchSystemStats = async () => {
    try {
      // Fetch user stats
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('is_active');

      if (usersError) throw usersError;

      // Fetch proxy stats
      const { data: proxies, error: proxiesError } = await supabase
        .from('proxies')
        .select('is_used');

      if (proxiesError) throw proxiesError;

      // Fetch usage stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data: todayLogs, error: todayError } = await supabase
        .from('usage_logs')
        .select('amount')
        .gte('created_at', today.toISOString());

      if (todayError) throw todayError;

      const { data: weeklyLogs, error: weeklyError } = await supabase
        .from('usage_logs')
        .select('amount')
        .gte('created_at', weekAgo.toISOString());

      if (weeklyError) throw weeklyError;

      setStats({
        totalUsers: users?.length || 0,
        activeUsers: users?.filter(u => u.is_active).length || 0,
        totalProxies: proxies?.length || 0,
        usedProxies: proxies?.filter(p => p.is_used).length || 0,
        todayUsage: todayLogs?.reduce((sum, log) => sum + log.amount, 0) || 0,
        weeklyUsage: weeklyLogs?.reduce((sum, log) => sum + log.amount, 0) || 0
      });

    } catch (error) {
      console.error('Error fetching system stats:', error);
      toast.error('Error loading system statistics');
    }
  };

  const fetchUserUsages = async () => {
    try {
      // Fetch all users
      let usersQuery = supabase.from('users').select('*').order('username');
      
      // If manager, exclude admin users
      if (user?.role === 'manager') {
        usersQuery = usersQuery.neq('role', 'admin');
      }
      
      const { data: users, error: usersError } = await usersQuery;

      if (usersError) throw usersError;

      // Fetch usage logs for all users
      const { data: logs, error: logsError } = await supabase
        .from('usage_logs')
        .select('*');

      if (logsError) throw logsError;

      // Calculate usage for each user
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const userUsageData: UserUsage[] = users?.map(user => {
        const userLogs = logs?.filter(log => log.user_id === user.id) || [];
        
        const todayUsage = userLogs
          .filter(log => new Date(log.created_at) >= today)
          .reduce((sum, log) => sum + log.amount, 0);

        const weeklyUsage = userLogs
          .filter(log => new Date(log.created_at) >= weekAgo)
          .reduce((sum, log) => sum + log.amount, 0);

        const monthlyUsage = userLogs
          .filter(log => new Date(log.created_at) >= monthAgo)
          .reduce((sum, log) => sum + log.amount, 0);

        return {
          user,
          todayUsage,
          weeklyUsage,
          monthlyUsage
        };
      }) || [];

      setUserUsages(userUsageData);

    } catch (error) {
      console.error('Error fetching user usages:', error);
      toast.error('Error loading user usage data');
    }
  };

  const fetchRecentLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('usage_logs')
        .select(`
          *,
          users!usage_logs_user_id_fkey(username)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentLogs(data || []);

    } catch (error) {
      console.error('Error fetching recent logs:', error);
      toast.error('Error loading recent activity');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllProxies = async () => {
    if (!confirm('Are you sure you want to delete ALL proxies? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('proxies')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;
      toast.success('All proxies deleted successfully');
      fetchSystemStats(); // Refresh stats
    } catch (error) {
      console.error('Error clearing proxies:', error);
      toast.error('Error clearing proxies');
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Status</h1>
          <p className="mt-2 text-gray-600">Monitor system performance and user activity</p>
        </div>

        {/* System Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-blue-100 rounded-full p-3">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                <p className="text-xs text-gray-500">
                  {stats.activeUsers} active
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-green-100 rounded-full p-3">
                <Database className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Proxies</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProxies}</p>
                <p className="text-xs text-gray-500">
                  {stats.totalProxies - stats.usedProxies} available
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="bg-purple-100 rounded-full p-3">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Usage</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todayUsage}</p>
                <p className="text-xs text-gray-500">
                  {stats.weeklyUsage} this week
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* User Usage Table */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">User Usage Statistics</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Today
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Week
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userUsages.map((userUsage) => (
                    <tr key={userUsage.user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {userUsage.user.username}
                            </div>
                            <div className="text-sm text-gray-500">
                              {userUsage.user.role}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {userUsage.todayUsage}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          {userUsage.weeklyUsage}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          {userUsage.monthlyUsage}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center space-x-3">
                    <div className="bg-blue-100 rounded-full p-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {(log as any).users?.username || 'Unknown User'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Generated {log.amount} IPs
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                {recentLogs.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No recent activity</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};