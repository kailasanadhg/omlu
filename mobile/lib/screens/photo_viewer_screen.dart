import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/models.dart';
import 'package:omlu/core/date_utils.dart';

class PhotoViewerScreen extends StatefulWidget {
  final Memory memory;
  final int initialIndex;
  final VoidCallback? onLikeToggle;

  const PhotoViewerScreen({
    super.key,
    required this.memory,
    this.initialIndex = 0,
    this.onLikeToggle,
  });

  @override
  State<PhotoViewerScreen> createState() => _PhotoViewerScreenState();
}

class _PhotoViewerScreenState extends State<PhotoViewerScreen> {
  late PageController _pageController;
  late int _currentIndex;
  bool _showControls = true;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersive);
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    _pageController.dispose();
    super.dispose();
  }

  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OmluColors.photoSurface,
      body: GestureDetector(
        onTap: _toggleControls,
        onVerticalDragEnd: (details) {
          if (details.primaryVelocity! > 200) {
            Navigator.of(context).pop();
          }
        },
        child: Stack(
          children: [
            PhotoViewGallery.builder(
              scrollPhysics: const BouncingScrollPhysics(),
              builder: (BuildContext context, int index) {
                final mediaItem = widget.memory.mediaItems[index];
                final url = OmluImageTransform.optimize(mediaItem.secureUrl, type: 'full');
                return PhotoViewGalleryPageOptions(
                  imageProvider: CachedNetworkImageProvider(url),
                  initialScale: PhotoViewComputedScale.contained,
                  minScale: PhotoViewComputedScale.contained,
                  maxScale: PhotoViewComputedScale.covered * 2,
                  heroAttributes: PhotoViewHeroAttributes(tag: 'memory_${widget.memory.id}_$index'),
                );
              },
              itemCount: widget.memory.mediaItems.length,
              loadingBuilder: (context, event) => const Center(
                child: CircularProgressIndicator(color: OmluColors.surface),
              ),
              backgroundDecoration: const BoxDecoration(
                color: OmluColors.photoSurface,
              ),
              pageController: _pageController,
              onPageChanged: (int index) {
                setState(() {
                  _currentIndex = index;
                });
              },
            ),
            
            // Top Controls
            AnimatedOpacity(
              opacity: _showControls ? 1.0 : 0.0,
              duration: OmluDurations.fast,
              child: SafeArea(
                child: Align(
                  alignment: Alignment.topCenter,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: OmluSpacing.md,
                      vertical: OmluSpacing.sm,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.close, color: OmluColors.surface),
                          onPressed: () => Navigator.of(context).pop(),
                        ),
                        if (widget.memory.mediaItems.length > 1)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: OmluSpacing.sm,
                              vertical: OmluSpacing.xxs,
                            ),
                            decoration: BoxDecoration(
                              color: OmluColors.scrim,
                              borderRadius: BorderRadius.circular(OmluRadii.full),
                            ),
                            child: Text(
                              '${_currentIndex + 1} / ${widget.memory.mediaItems.length}',
                              style: const TextStyle(color: OmluColors.surface),
                            ),
                          ),
                        const SizedBox(width: 48), // Balance for close button
                      ],
                    ),
                  ),
                ),
              ),
            ),
            
            // Bottom Metadata and Actions
            AnimatedOpacity(
              opacity: _showControls ? 1.0 : 0.0,
              duration: OmluDurations.fast,
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [Colors.black87, Colors.transparent],
                    ),
                  ),
                  padding: EdgeInsets.only(
                    left: OmluSpacing.md,
                    right: OmluSpacing.md,
                    bottom: MediaQuery.of(context).padding.bottom + OmluSpacing.md,
                    top: OmluSpacing.xl,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.memory.authorDisplayName,
                              style: const TextStyle(
                                color: OmluColors.surface,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            const SizedBox(height: OmluSpacing.xxs),
                            Text(
                              '${widget.memory.spaceName} · ${formatShortDate(widget.memory.memoryDate)}',
                              style: TextStyle(
                                color: OmluColors.surface.withValues(alpha: 0.8),
                                fontSize: 13,
                              ),
                            ),
                            if (widget.memory.caption != null && widget.memory.caption!.isNotEmpty) ...[
                              const SizedBox(height: OmluSpacing.xs),
                              Text(
                                widget.memory.caption!,
                                style: const TextStyle(color: OmluColors.surface),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ]
                          ],
                        ),
                      ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: Icon(
                              widget.memory.isLikedByMe ? Icons.favorite : Icons.favorite_border,
                              color: widget.memory.isLikedByMe ? OmluColors.like : OmluColors.surface,
                            ),
                            onPressed: widget.onLikeToggle,
                          ),
                          Text(
                            '${widget.memory.likesCount}',
                            style: const TextStyle(color: OmluColors.surface, fontSize: 12),
                          ),
                          const SizedBox(height: OmluSpacing.sm),
                          const Icon(Icons.chat_bubble_outline, color: OmluColors.surface),
                          const SizedBox(height: OmluSpacing.xxs),
                          Text(
                            '${widget.memory.commentsCount}',
                            style: const TextStyle(color: OmluColors.surface, fontSize: 12),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
