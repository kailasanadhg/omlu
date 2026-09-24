import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:omlu/core/api_client.dart';
import 'package:omlu/core/models.dart';
import 'package:omlu/core/date_utils.dart';
import 'package:omlu/core/design_system.dart';

class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  List<ActivityItem>? _items;
  bool _isLoading = true;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _fetchActivity();
  }

  Future<void> _fetchActivity() async {
    setState(() {
      _isLoading = _items == null;
      _hasError = false;
    });

    try {
      final api = context.read<ApiClient>();
      final response = await api.get<List<dynamic>>('/activity');
      final items = response.map((e) => ActivityItem.fromJson(e)).toList();

      setState(() {
        _items = items;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _hasError = true;
        _isLoading = false;
      });
    }
  }

  String _getEventDescription(ActivityItem item) {
    switch (item.type) {
      case 'like':
        return 'liked your memory';
      case 'comment':
        return 'commented: "${item.content ?? ''}"';
      case 'note':
        return 'added a note to your memory';
      case 'joined_space':
        return 'joined the space';
      default:
        return 'interacted with your content';
    }
  }

  IconData _getEventIcon(ActivityItem item) {
    switch (item.type) {
      case 'like':
        return Icons.favorite;
      case 'comment':
        return Icons.chat_bubble;
      case 'note':
        return Icons.edit_note;
      case 'joined_space':
        return Icons.group_add;
      default:
        return Icons.notifications;
    }
  }

  Color _getEventIconColor(ActivityItem item) {
    switch (item.type) {
      case 'like':
        return Colors.red;
      case 'comment':
        return Colors.blue;
      case 'note':
        return Colors.orange;
      case 'joined_space':
        return Colors.green;
      default:
        return OmluColors.textSecondary;
    }
  }

  void _onItemTapped(ActivityItem item) {
    // Basic navigation routing (assume routes are setup elsewhere)
    if (item.memoryId != null) {
      // Navigate to memory viewer
      // Navigator.pushNamed(context, '/memory', arguments: item.memoryId);
    } else if (item.spaceId != null) {
      // Navigate to space
      // Navigator.pushNamed(context, '/space', arguments: item.spaceId);
    }
  }

  Widget _buildShimmer() {
    return ListView.builder(
      itemCount: 10,
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemBuilder: (context, index) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: OmluColors.shimmerBase,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      height: 14,
                      color: OmluColors.shimmerBase,
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: 100,
                      height: 12,
                      color: OmluColors.shimmerBase,
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OmluColors.background,
      appBar: AppBar(
        title: Text('Activity', style: OmluTypography.sectionHeader),
        backgroundColor: OmluColors.background,
        elevation: 0,
      ),
      body: _isLoading
          ? _buildShimmer()
          : _hasError
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
                  Text(
                    'Failed to load activity',
                    style: OmluTypography.bodyLarge,
                  ),
                  TextButton(
                    onPressed: _fetchActivity,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            )
          : _items!.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.notifications_none,
                    size: 64,
                    color: OmluColors.textSecondary,
                  ),
                  const SizedBox(height: 16),
                  Text('No activity yet', style: OmluTypography.bodyLarge),
                  const SizedBox(height: 8),
                  Text(
                    'When people interact with your memories,\nit will show up here.',
                    textAlign: TextAlign.center,
                    style: OmluTypography.body.copyWith(
                      color: OmluColors.textSecondary,
                    ),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _fetchActivity,
              color: OmluColors.primary,
              child: ListView.builder(
                itemCount: _items!.length,
                itemBuilder: (context, index) {
                  final item = _items![index];

                  return InkWell(
                    onTap: () => _onItemTapped(item),
                    child: Container(
                      color: item.isRead
                          ? Colors.transparent
                          : OmluColors.shimmerBase,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Stack(
                            children: [
                              CircleAvatar(
                                radius: 24,
                                backgroundColor: OmluColors.shimmerBase,
                                backgroundImage: item.actorAvatarUrl != null
                                    ? CachedNetworkImageProvider(
                                        item.actorAvatarUrl!,
                                      )
                                    : null,
                                child: item.actorAvatarUrl == null
                                    ? Text(
                                        item.actorDisplayName.isNotEmpty
                                            ? item.actorDisplayName[0]
                                                  .toUpperCase()
                                            : '?',
                                        style: OmluTypography.bodyLarge.copyWith(
                                          color: OmluColors.textSecondary,
                                        ),
                                      )
                                    : null,
                              ),
                              Positioned(
                                right: 0,
                                bottom: 0,
                                child: Container(
                                  padding: const EdgeInsets.all(2),
                                  decoration: BoxDecoration(
                                    color: OmluColors.background,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(
                                    _getEventIcon(item),
                                    size: 14,
                                    color: _getEventIconColor(item),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                RichText(
                                  text: TextSpan(
                                    style: OmluTypography.body.copyWith(
                                      color: OmluColors.textPrimary,
                                    ),
                                    children: [
                                      TextSpan(
                                        text: item.actorDisplayName,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      const TextSpan(text: ' '),
                                      TextSpan(
                                        text: _getEventDescription(item),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  formatRelativeTime(item.createdAt),
                                  style: OmluTypography.bodySmall.copyWith(
                                    color: OmluColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
