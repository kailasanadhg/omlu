import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:provider/provider.dart';
import 'package:omlu/core/auth_provider.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/models.dart';
import 'package:omlu/widgets/masonry_photo_cell.dart';
import 'package:omlu/widgets/space_circles.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Memory>? _memories;
  List<Space>? _spaces;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    if (!mounted) return;
    setState(() {
      _error = null;
      if (_memories == null) {
        _isLoading = true;
      }
    });

    try {
      final apiClient = Provider.of<AuthProvider>(context, listen: false).api;
      
      // Fetch both in parallel
      final results = await Future.wait([
        apiClient.get<List<dynamic>>('/memories/feed'),
        apiClient.get<List<dynamic>>('/spaces'),
      ]);

      final feedData = results[0];
      final spacesData = results[1];

      if (mounted) {
        setState(() {
          _memories = feedData.map((e) => Memory.fromJson(e)).toList();
          _spaces = spacesData.map((e) => Space.fromJson(e)).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load feed.';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OmluColors.background,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchData,
          color: OmluColors.primary,
          backgroundColor: OmluColors.surface,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              _buildTopBar(),
              _buildSpaceCircles(),
              _buildContent(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopBar() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: OmluSpacing.md,
          vertical: OmluSpacing.sm,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'OMLU',
              style: TextStyle(
                fontFamily: 'SF Pro Display',
                fontSize: 24,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
                color: OmluColors.textPrimary,
              ),
            ),
            IconButton(
              icon: const Icon(Icons.person_outline),
              color: OmluColors.textPrimary,
              onPressed: () {
                // Navigate to profile
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSpaceCircles() {
    if (_isLoading && _spaces == null) {
      return const SliverToBoxAdapter(
        child: SizedBox(
          height: 104,
          child: Center(
            child: CircularProgressIndicator.adaptive(),
          ),
        ),
      );
    }
    
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.only(bottom: OmluSpacing.md),
        child: SpaceCircles(
          spaces: _spaces ?? [],
          onCreateSpace: () {
            // Create space action
          },
          onSpaceTap: (space) {
            // Navigate to space
          },
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
    if (_isLoading && _memories == null) {
      return SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: OmluSpacing.gridPadding),
        sliver: SliverMasonryGrid.count(
          crossAxisCount: OmluBreakpoints.masonryColumns(MediaQuery.of(context).size.width),
          mainAxisSpacing: OmluSpacing.gridGap,
          crossAxisSpacing: OmluSpacing.gridGap,
          childCount: 10,
          itemBuilder: (context, index) {
            final heights = const [200.0, 150.0, 250.0, 180.0];
            return Container(
              height: heights[index % heights.length],
              decoration: BoxDecoration(
                color: OmluColors.shimmerBase,
                borderRadius: BorderRadius.circular(OmluRadii.xs),
              ),
            );
          },
        ),
      );
    }

    if (_error != null) {
      return SliverFillRemaining(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, style: OmluTypography.body),
              const SizedBox(height: OmluSpacing.md),
              ElevatedButton(
                onPressed: _fetchData,
                style: ElevatedButton.styleFrom(
                  backgroundColor: OmluColors.primary,
                  foregroundColor: OmluColors.textInverse,
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_memories == null || _memories!.isEmpty) {
      return SliverFillRemaining(
        child: Center(
          child: Text(
            'No memories yet. Create a space to get started.',
            style: OmluTypography.bodySmall,
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: OmluSpacing.gridPadding),
      sliver: SliverMasonryGrid.count(
        crossAxisCount: OmluBreakpoints.masonryColumns(MediaQuery.of(context).size.width),
        mainAxisSpacing: OmluSpacing.gridGap,
        crossAxisSpacing: OmluSpacing.gridGap,
        childCount: _memories!.length,
        itemBuilder: (context, index) {
          final memory = _memories![index];
          return MasonryPhotoCell(
            memory: memory,
            onTap: () {
              // Open photo viewer
            },
          );
        },
      ),
    );
  }
}
