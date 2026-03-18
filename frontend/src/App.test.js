import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Assistive OS shell', () => {
  render(<App />);
  expect(screen.getByText(/assistive os/i)).toBeInTheDocument();
});
