import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:omlu/core/api_client.dart';
import 'package:omlu/core/models.dart';
import 'package:omlu/core/date_utils.dart';
import 'package:omlu/core/design_system.dart';

class CommentSheet extends StatefulWidget {
  final String memoryId;

  const CommentSheet({super.key, required this.memoryId});

  static void show(BuildContext context, String memoryId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: CommentSheet(memoryId: memoryId),
      ),
    );
  }

  @override
  State<CommentSheet> createState() => _CommentSheetState();
}

class _CommentSheetState extends State<CommentSheet> {
  final TextEditingController _commentController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  List<Comment>? _comments;
  bool _isLoading = true;
  bool _isPosting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchComments();
  }

  @override
  void dispose() {
    _commentController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _fetchComments() async {
    try {
      final api = context.read<ApiClient>();
      final response = await api.get<List<dynamic>>(
        '/memories/${widget.memoryId}/comments',
      );
      final comments = response.map((e) => Comment.fromJson(e)).toList();

      setState(() {
        _comments = comments;
        _isLoading = false;
      });

      _scrollToBottom();
    } catch (e) {
      setState(() {
        _error = 'Failed to load comments';
        _isLoading = false;
      });
    }
  }

  Future<void> _postComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty || _isPosting) return;

    setState(() {
      _isPosting = true;
    });

    try {
      final api = context.read<ApiClient>();
      final response = await api.post<Map<String, dynamic>>(
        '/memories/${widget.memoryId}/comments',
        body: {'body': text},
      );

      final newComment = Comment.fromJson(response);

      setState(() {
        _comments?.add(newComment);
        _commentController.clear();
        _isPosting = false;
      });

      _scrollToBottom();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isPosting = false;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Failed to post comment')));
    }
  }

  Future<void> _deleteComment(String commentId) async {
    try {
      final api = context.read<ApiClient>();
      await api.delete('/memories/${widget.memoryId}/comments/$commentId');

      if (!mounted) return;
      setState(() {
        _comments?.removeWhere((c) => c.id == commentId);
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Failed to delete comment')));
    }
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      Future.delayed(const Duration(milliseconds: 100), () {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: OmluColors.background,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        children: [
          // Handle bar
          Container(
            margin: const EdgeInsets.symmetric(vertical: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: OmluColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          Text('Comments', style: OmluTypography.bodyLarge),
          const SizedBox(height: 8),
          const Divider(height: 1, color: OmluColors.border),

          // Comments list
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: OmluColors.primary),
                  )
                : _error != null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.error_outline,
                          size: 48,
                          color: OmluColors.textSecondary,
                        ),
                        const SizedBox(height: 16),
                        Text(_error!, style: OmluTypography.bodyLarge),
                        TextButton(
                          onPressed: () {
                            setState(() {
                              _isLoading = true;
                              _error = null;
                            });
                            _fetchComments();
                          },
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  )
                : _comments!.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.chat_bubble_outline,
                          size: 48,
                          color: OmluColors.textSecondary,
                        ),
                        const SizedBox(height: 16),
                        Text('No comments yet', style: OmluTypography.bodyLarge),
                        Text(
                          'Be the first to comment!',
                          style: OmluTypography.body.copyWith(
                            color: OmluColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _comments!.length,
                    itemBuilder: (context, index) {
                      final comment = _comments![index];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 16.0),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              radius: 16,
                              backgroundColor: OmluColors.shimmerBase,
                              backgroundImage: comment.authorAvatarUrl != null
                                  ? CachedNetworkImageProvider(
                                      comment.authorAvatarUrl!,
                                    )
                                  : null,
                              child: comment.authorAvatarUrl == null
                                  ? Text(
                                      comment.authorDisplayName.isNotEmpty
                                          ? comment.authorDisplayName[0]
                                                .toUpperCase()
                                          : '?',
                                      style: OmluTypography.bodySmall.copyWith(
                                        color: OmluColors.textSecondary,
                                      ),
                                    )
                                  : null,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        comment.authorDisplayName,
                                        style: OmluTypography.body
                                            .copyWith(
                                              fontWeight: FontWeight.bold,
                                            ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        formatRelativeTime(comment.createdAt),
                                        style: OmluTypography.bodySmall.copyWith(
                                          color: OmluColors.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    comment.body,
                                    style: OmluTypography.body,
                                  ),
                                ],
                              ),
                            ),
                            if (comment.canDelete)
                              IconButton(
                                icon: const Icon(
                                  Icons.delete_outline,
                                  size: 20,
                                  color: OmluColors.textSecondary,
                                ),
                                onPressed: () => _deleteComment(comment.id),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
          ),

          // Input area
          SafeArea(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: const BoxDecoration(
                color: OmluColors.background,
                border: Border(top: BorderSide(color: OmluColors.border)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _commentController,
                      decoration: InputDecoration(
                        hintText: 'Add a comment...',
                        hintStyle: TextStyle(color: OmluColors.textSecondary),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                        filled: true,
                        fillColor: OmluColors.shimmerBase,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                      ),
                      textCapitalization: TextCapitalization.sentences,
                      minLines: 1,
                      maxLines: 4,
                      onSubmitted: (_) => _postComment(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _isPosting
                      ? const Padding(
                          padding: EdgeInsets.all(12.0),
                          child: SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              color: OmluColors.primary,
                              strokeWidth: 2,
                            ),
                          ),
                        )
                      : IconButton(
                          icon: const Icon(
                            Icons.send,
                            color: OmluColors.primary,
                          ),
                          onPressed: _postComment,
                        ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
