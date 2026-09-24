import 'package:flutter/material.dart';
import 'package:omlu/core/api_client.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/models.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:omlu/screens/photo_viewer_screen.dart';
import 'package:omlu/widgets/invite_sheet.dart';

class SpaceDetailScreen extends StatefulWidget {
  final String spaceId;

  const SpaceDetailScreen({super.key, required this.spaceId});

  @override
  State<SpaceDetailScreen> createState() => _SpaceDetailScreenState();
}

class _SpaceDetailScreenState extends State<SpaceDetailScreen> {
  Space? _space;
  List<Memory> _memories = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final api = context.read<ApiClient>();
      
      final responses = await Future.wait([
        api.get<Map<String, dynamic>>('/spaces/${widget.spaceId}'),
        api.get<List<dynamic>>('/memories/space/${widget.spaceId}'),
      ]);

      setState(() {
        _space = Space.fromJson(responses[0] as Map<String, dynamic>);
        _memories = (responses[1] as List<dynamic>)
            .map((e) => Memory.fromJson(e as Map<String, dynamic>))
            .toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load space: $e')),
        );
      }
    }
  }

  void _showInviteSheet() {
    if (_space == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => InviteSheet(space: _space!),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _space == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: OmluColors.primary)),
      );
    }

    if (_space == null) {
      return const Scaffold(
        body: Center(child: Text('Space not found')),
      );
    }

    final screenWidth = MediaQuery.of(context).size.width;
    final columnCount = OmluBreakpoints.masonryColumns(screenWidth);

    return Scaffold(
      backgroundColor: OmluColors.background,
      body: RefreshIndicator(
        onRefresh: _fetchData,
        color: OmluColors.primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          slivers: [
            SliverAppBar(
              backgroundColor: OmluColors.background,
              pinned: true,
              expandedHeight: 280.0,
              flexibleSpace: FlexibleSpaceBar(
                background: Column(
                  children: [
                    Container(
                      height: 140,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        gradient: _space!.coverUrl == null
                            ? const LinearGradient(
                                colors: [OmluColors.tertiary, OmluColors.secondaryLight],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              )
                            : null,
                      ),
                      child: _space!.coverUrl != null
                          ? CachedNetworkImage(
                              imageUrl: OmluImageTransform.optimize(_space!.coverUrl, type: 'cover'),
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                    Padding(
                      padding: const EdgeInsets.all(OmluSpacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_space!.name, style: OmluTypography.pageTitle),
                          if (_space!.description != null) ...[
                            const SizedBox(height: OmluSpacing.xs),
                            Text(_space!.description!, style: OmluTypography.bodySmall),
                          ],
                          const SizedBox(height: OmluSpacing.xs),
                          Text(
                            '${_space!.membersCount} members · ${_space!.memoriesCount} memories',
                            style: OmluTypography.caption,
                          ),
                          const SizedBox(height: OmluSpacing.md),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: () {},
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: OmluColors.primary,
                                    foregroundColor: OmluColors.textInverse,
                                    elevation: 0,
                                    padding: const EdgeInsets.symmetric(vertical: OmluSpacing.sm),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(OmluRadii.full),
                                    ),
                                  ),
                                  child: const Text('Capture', style: OmluTypography.button),
                                ),
                              ),
                              const SizedBox(width: OmluSpacing.md),
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: _showInviteSheet,
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: OmluColors.primary,
                                    side: const BorderSide(color: OmluColors.border),
                                    padding: const EdgeInsets.symmetric(vertical: OmluSpacing.sm),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(OmluRadii.full),
                                    ),
                                  ),
                                  child: const Text('Invite', style: OmluTypography.button),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              iconTheme: const IconThemeData(color: OmluColors.primary),
            ),
            if (_memories.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Text('No memories yet.', style: OmluTypography.bodyLarge),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: OmluSpacing.gridPadding),
                sliver: SliverMasonryGrid.count(
                  crossAxisCount: columnCount,
                  mainAxisSpacing: OmluSpacing.gridGap,
                  crossAxisSpacing: OmluSpacing.gridGap,
                  childCount: _memories.length,
                  itemBuilder: (context, index) {
                    final memory = _memories[index];
                    final media = memory.mediaItems.first;
                    return GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => PhotoViewerScreen(memory: memory),
                          ),
                        );
                      },
                      child: Hero(
                        tag: 'memory_${memory.id}_0',
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(OmluRadii.xs),
                          child: CachedNetworkImage(
                            imageUrl: OmluImageTransform.optimize(media.secureUrl, type: 'masonry'),
                            fit: BoxFit.cover,
                            placeholder: (context, url) => AspectRatio(
                              aspectRatio: media.aspectRatio,
                              child: Container(color: OmluColors.shimmerBase),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
