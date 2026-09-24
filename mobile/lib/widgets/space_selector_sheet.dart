import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:omlu/core/api_client.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/models.dart';

class SpaceSelectorSheet extends StatefulWidget {
  const SpaceSelectorSheet({super.key});

  @override
  State<SpaceSelectorSheet> createState() => _SpaceSelectorSheetState();
}

class _SpaceSelectorSheetState extends State<SpaceSelectorSheet> {
  bool _isLoading = true;
  List<Space> _spaces = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchSpaces();
  }

  Future<void> _fetchSpaces() async {
    try {
      final apiClient = Provider.of<ApiClient>(context, listen: false);
      final response = await apiClient.get<Map<String, dynamic>>('/spaces');
      
      final spacesList = (response['items'] as List?)
          ?.map((e) => Space.fromJson(e as Map<String, dynamic>))
          .toList() ?? [];

      if (mounted) {
        setState(() {
          _spaces = spacesList;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load spaces';
          _isLoading = false;
        });
      }
    }
  }

  void _navigateToCamera(Space space) {
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Navigate to camera for ${space.name}')),
    );
  }

  void _createSpace() {
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Create Space tapped')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.7,
      ),
      decoration: const BoxDecoration(
        color: OmluColors.surface,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(OmluRadii.xl),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: OmluSpacing.xs),
          // Drag handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: OmluColors.tertiary,
              borderRadius: BorderRadius.circular(OmluRadii.full),
            ),
          ),
          const SizedBox(height: OmluSpacing.md),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: OmluSpacing.md),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Select a Space',
                style: OmluTypography.sectionHeader,
              ),
            ),
          ),
          const SizedBox(height: OmluSpacing.sm),
          const Divider(),
          Flexible(
            child: _buildContent(),
          ),
          const Divider(),
          InkWell(
            onTap: _createSpace,
            child: Padding(
              padding: const EdgeInsets.all(OmluSpacing.md),
              child: Row(
                children: [
                  Container(
                    width: OmluSizes.avatarMd,
                    height: OmluSizes.avatarMd,
                    decoration: BoxDecoration(
                      color: OmluColors.primaryLight,
                      borderRadius: BorderRadius.circular(OmluRadii.sm),
                    ),
                    child: const Icon(
                      Icons.add,
                      color: OmluColors.textInverse,
                      size: OmluSizes.iconSm,
                    ),
                  ),
                  const SizedBox(width: OmluSpacing.md),
                  Text(
                    'Create Space',
                    style: OmluTypography.bodyLarge.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: MediaQuery.of(context).padding.bottom),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return ListView.builder(
        shrinkWrap: true,
        itemCount: 3,
        padding: const EdgeInsets.symmetric(vertical: OmluSpacing.sm),
        itemBuilder: (context, index) => _buildShimmerItem(),
      );
    }

    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.all(OmluSpacing.xl),
        child: Center(
          child: Text(
            _error!,
            style: OmluTypography.body.copyWith(color: OmluColors.error),
          ),
        ),
      );
    }

    if (_spaces.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(OmluSpacing.xl),
        child: Center(
          child: Text(
            'No spaces found.',
            style: OmluTypography.body.copyWith(color: OmluColors.textSecondary),
          ),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      padding: const EdgeInsets.symmetric(vertical: OmluSpacing.sm),
      itemCount: _spaces.length,
      itemBuilder: (context, index) {
        final space = _spaces[index];
        return InkWell(
          onTap: () => _navigateToCamera(space),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: OmluSpacing.md,
              vertical: OmluSpacing.sm,
            ),
            child: Row(
              children: [
                _buildCoverImage(space.coverUrl),
                const SizedBox(width: OmluSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        space.name,
                        style: OmluTypography.bodyLarge.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${space.membersCount} members',
                        style: OmluTypography.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildCoverImage(String? url) {
    if (url == null || url.isEmpty) {
      return Container(
        width: OmluSizes.avatarMd,
        height: OmluSizes.avatarMd,
        decoration: BoxDecoration(
          color: OmluColors.tertiary,
          borderRadius: BorderRadius.circular(OmluRadii.sm),
        ),
        child: const Icon(
          Icons.grid_view,
          color: OmluColors.textSecondary,
          size: OmluSizes.iconSm,
        ),
      );
    }

    final optimizedUrl = OmluImageTransform.optimize(url, type: 'avatar');
    return ClipRRect(
      borderRadius: BorderRadius.circular(OmluRadii.sm),
      child: CachedNetworkImage(
        imageUrl: optimizedUrl,
        width: OmluSizes.avatarMd,
        height: OmluSizes.avatarMd,
        fit: BoxFit.cover,
        placeholder: (context, url) => Container(
          color: OmluColors.shimmerBase,
        ),
        errorWidget: (context, url, error) => Container(
          color: OmluColors.tertiary,
          child: const Icon(Icons.error, size: OmluSizes.iconSm),
        ),
      ),
    );
  }

  Widget _buildShimmerItem() {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: OmluSpacing.md,
        vertical: OmluSpacing.sm,
      ),
      child: Row(
        children: [
          Container(
            width: OmluSizes.avatarMd,
            height: OmluSizes.avatarMd,
            decoration: BoxDecoration(
              color: OmluColors.shimmerBase,
              borderRadius: BorderRadius.circular(OmluRadii.sm),
            ),
          ),
          const SizedBox(width: OmluSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 120,
                  height: 16,
                  color: OmluColors.shimmerBase,
                ),
                const SizedBox(height: 8),
                Container(
                  width: 60,
                  height: 12,
                  color: OmluColors.shimmerBase,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
