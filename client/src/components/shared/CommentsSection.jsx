import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/formatters';

const ROLE_COLORS = {
  owner: 'bg-purple-100 text-purple-700',
  pm: 'bg-blue-100 text-blue-700',
  engineer: 'bg-green-100 text-green-700',
  contractor: 'bg-orange-100 text-orange-700',
  inspector: 'bg-teal-100 text-teal-700',
  procurement: 'bg-yellow-100 text-yellow-700',
  accounts: 'bg-pink-100 text-pink-700',
};

export default function CommentsSection({ entityType, entityId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const loadComments = () => {
    if (!entityType || !entityId) return;
    api.get(`/comments?entity_type=${entityType}&entity_id=${entityId}`)
      .then(setComments).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadComments(); }, [entityType, entityId]);

  const handlePost = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      await api.post('/comments', { entity_type: entityType, entity_id: entityId, content: newComment.trim() });
      setNewComment('');
      loadComments();
    } catch (err) {
      alert(err.message || 'Failed to post comment');
    } finally { setPosting(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.delete(`/comments/${id}`);
      loadComments();
    } catch (err) { alert(err.message); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePost();
    }
  };

  return (
    <div className="border-t pt-4 mt-4">
      <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">
        Comments ({comments.length})
      </h4>

      {loading ? (
        <p className="text-xs text-slate-400">Loading comments...</p>
      ) : (
        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-slate-600">
                  {(c.user_name || '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">{c.user_name}</span>
                  {c.user_role && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[c.user_role] || 'bg-slate-100 text-slate-600'}`}>
                      {c.user_role}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">{formatDate(c.created_at)}</span>
                  {(c.user_id === user?.id || ['owner', 'pm'].includes(user?.role)) && (
                    <button onClick={() => handleDelete(c.id)} className="text-[10px] text-slate-400 hover:text-red-500 ml-auto">delete</button>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-2">No comments yet</p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment... (Enter to send)"
          rows={2}
          className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none"
        />
        <button onClick={handlePost} disabled={posting || !newComment.trim()}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 self-end">
          {posting ? '...' : 'Post'}
        </button>
      </div>
    </div>
  );
}