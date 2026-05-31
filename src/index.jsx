import { registerRoot, Composition } from 'remotion';
import { CryptoNews } from './CryptoNews';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="CryptoNews"
        component={CryptoNews}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          title: "Bitcoin breaks $100K resistance level",
          price: "103,240",
          change: "+4.2",
          ticker: "BTC",
          color: "#f7931a",
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
