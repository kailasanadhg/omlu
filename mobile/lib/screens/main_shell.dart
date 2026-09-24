import 'package:flutter/material.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/widgets/space_selector_sheet.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  final List<Widget> _pages = const [
    Center(child: Text('Home', style: OmluTypography.pageTitle)),
    Center(child: Text('Spaces', style: OmluTypography.pageTitle)),
    SizedBox.shrink(), // Placeholder for capture, not actually used
    Center(child: Text('Activity', style: OmluTypography.pageTitle)),
    Center(child: Text('Profile', style: OmluTypography.pageTitle)),
  ];

  void _onTabTapped(int index) {
    if (index == 2) {
      _showSpaceSelector();
    } else {
      setState(() {
        _currentIndex = index;
      });
    }
  }

  void _showSpaceSelector() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent, // To show sheet styling properly
      builder: (context) => const SpaceSelectorSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: OmluColors.surface,
          border: Border(
            top: BorderSide(
              color: OmluColors.divider,
              width: 0.5,
            ),
          ),
        ),
        child: SafeArea(
          bottom: true,
          child: SizedBox(
            height: OmluSizes.bottomNavHeight,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildNavItem(0, Icons.home_outlined, Icons.home),
                _buildNavItem(1, Icons.grid_view_outlined, Icons.grid_view_rounded),
                _buildCaptureButton(),
                _buildNavItem(3, Icons.notifications_none_outlined, Icons.notifications),
                _buildNavItem(4, Icons.person_outline, Icons.person),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, IconData unselectedIcon, IconData selectedIcon) {
    final isSelected = _currentIndex == index;
    final color = isSelected ? OmluColors.primary : OmluColors.secondaryLight;
    
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => _onTabTapped(index),
        child: AnimatedContainer(
          duration: OmluDurations.fast,
          curve: OmluCurves.standard,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                isSelected ? selectedIcon : unselectedIcon,
                color: color,
                size: OmluSizes.iconMd,
              ),
              const SizedBox(height: OmluSpacing.xxxs),
              Text(
                _getLabelForIndex(index),
                style: OmluTypography.navLabel.copyWith(color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCaptureButton() {
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => _onTabTapped(2),
        child: Center(
          child: Container(
            width: OmluSizes.touchTargetSm,
            height: OmluSizes.touchTargetSm,
            decoration: const BoxDecoration(
              color: OmluColors.primary,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.add,
              color: OmluColors.textInverse,
              size: OmluSizes.iconLg,
            ),
          ),
        ),
      ),
    );
  }

  String _getLabelForIndex(int index) {
    switch (index) {
      case 0: return 'Home';
      case 1: return 'Spaces';
      case 2: return 'Capture';
      case 3: return 'Activity';
      case 4: return 'Profile';
      default: return '';
    }
  }
}
