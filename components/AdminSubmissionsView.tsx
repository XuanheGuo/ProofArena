'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { CheckCircle2, XCircle, Eye, Clock } from 'lucide-react';

type Submission = {
  id: string;
  submission_type: 'problem' | 'solution';
  problem_id: string | null;
  problem_source: string | null;
  kind: string;
  title: string;
  content: {
    markdown?: string;
    [key: string]: unknown;
  };
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  created_at: string;
  user_id: string;
  moderator_notes?: string | null;
};

export function AdminSubmissionsView() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSubmissions(data);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected' | 'needs_revision') => {
    const { error } = await supabase
      .from('submissions')
      .update({ status })
      .eq('id', id);

    if (!error) {
      await loadSubmissions();
      setSelectedSubmission(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'border-amber-400/30 bg-amber-400/[0.06] text-amber-300',
      approved: 'border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300',
      rejected: 'border-red-400/30 bg-red-400/[0.06] text-red-300',
      needs_revision: 'border-cyan-400/30 bg-cyan-400/[0.06] text-cyan-300',
    };
    const labels = { pending: '待审核', approved: '已通过', rejected: '已拒绝', needs_revision: '需修改' };
    return (
      <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-bold ${styles[status as keyof typeof styles]}`}>
        {status === 'pending' && <Clock className="size-3" />}
        {status === 'approved' && <CheckCircle2 className="size-3" />}
        {status === 'rejected' && <XCircle className="size-3" />}
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getTypeLabel = (submission: Submission) => submission.submission_type === 'problem' ? '题目投稿' : '解法投稿';
  const getTargetLabel = (submission: Submission) => {
    if (submission.submission_type === 'problem') return submission.problem_source ?? '新题';
    return submission.problem_source ? `${submission.problem_source} · ${submission.problem_id ?? '未绑定题目'}` : submission.problem_id ?? '未绑定题目';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="h-8 w-48 bg-white/5 rounded mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white/5 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-white">投稿审核</h1>
          <div className="flex gap-2 text-xs">
            <span className="text-zinc-500">
              待审核 <span className="text-amber-300 font-bold">{submissions.filter(s => s.status === 'pending').length}</span>
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-500">
              总计 <span className="text-white font-bold">{submissions.length}</span>
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="rounded border border-white/10 bg-white/[0.02] p-5 transition hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(sub.status)}
                    <span className="text-xs text-zinc-600">{new Date(sub.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                  <h3 className="text-white font-bold truncate">{sub.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{getTypeLabel(sub)} · {getTargetLabel(sub)} · 类型: {sub.kind}</p>
                </div>
                <button
                  onClick={() => setSelectedSubmission(sub)}
                  className="shrink-0 inline-flex h-9 items-center gap-2 border border-white/10 px-4 text-sm text-zinc-400 transition hover:border-cyan-400/50 hover:text-cyan-400"
                >
                  <Eye className="size-4" />
                  查看详情
                </button>
              </div>
            </div>
          ))}

          {submissions.length === 0 && (
            <div className="rounded border border-white/10 bg-white/[0.02] p-12 text-center">
              <p className="text-zinc-500">暂无投稿</p>
            </div>
          )}
        </div>

        {selectedSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedSubmission(null)}>
            <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded border border-white/10 bg-zinc-950 p-6" onClick={e => e.stopPropagation()}>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(selectedSubmission.status)}
                  <span className="text-xs text-zinc-600">{new Date(selectedSubmission.created_at).toLocaleString('zh-CN')}</span>
                </div>
                <h2 className="text-xl font-black text-white">{selectedSubmission.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">{getTypeLabel(selectedSubmission)} · {getTargetLabel(selectedSubmission)} · 类型: {selectedSubmission.kind}</p>
              </div>

              <div className="mb-6 rounded border border-white/10 bg-black/20 p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-300 leading-relaxed">
                  {selectedSubmission.content.markdown ?? JSON.stringify(selectedSubmission.content, null, 2)}
                </pre>
              </div>

              {selectedSubmission.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => updateStatus(selectedSubmission.id, 'approved')}
                    className="flex-1 h-11 inline-flex items-center justify-center gap-2 bg-emerald-400 text-zinc-950 font-bold transition hover:bg-emerald-300"
                  >
                    <CheckCircle2 className="size-4" />
                    通过审核
                  </button>
                  <button
                    onClick={() => updateStatus(selectedSubmission.id, 'rejected')}
                    className="flex-1 h-11 inline-flex items-center justify-center gap-2 border border-red-400/30 text-red-400 font-bold transition hover:bg-red-400/10"
                  >
                    <XCircle className="size-4" />
                    拒绝
                  </button>
                  <button
                    onClick={() => updateStatus(selectedSubmission.id, 'needs_revision')}
                    className="flex-1 h-11 inline-flex items-center justify-center gap-2 border border-cyan-400/30 text-cyan-300 font-bold transition hover:bg-cyan-400/10"
                  >
                    需修改
                  </button>
                </div>
              )}

              {selectedSubmission.status !== 'pending' && (
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="w-full h-11 border border-white/10 text-zinc-400 font-bold transition hover:border-white/20 hover:text-white"
                >
                  关闭
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
