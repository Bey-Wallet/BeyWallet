import * as React from "react";
import Svg, { G, Path } from "react-native-svg";

export type ArrowDownIconProps = {
    size?: number;
    color?: string;
};

const ArrowDownIcon: React.FC<ArrowDownIconProps> = ({ size = 24, color }) => {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <G fill={color}>
                <Path
                    fill={color}
                    d="M13.707 3.32a.75.75 0 0 1 1.054.12a13.75 13.75 0 0 1 .074 17.025a.75.75 0 1 1-1.182-.923a12.25 12.25 0 0 0-.066-15.168a.75.75 0 0 1 .12-1.054"
                />
                <Path
                    fill={color}
                    d="M11.36 5.188a.75.75 0 0 1 1.053.12a10.75 10.75 0 0 1 .059 13.31a.751.751 0 0 1-1.183-.923a9.25 9.25 0 0 0-.05-11.453a.75.75 0 0 1 .12-1.054"
                />
                <Path
                    fill={color}
                    d="M9.011 7.055a.75.75 0 0 1 1.054.12a7.75 7.75 0 0 1 .042 9.596a.75.75 0 1 1-1.182-.924a6.25 6.25 0 0 0-.034-7.738a.75.75 0 0 1 .12-1.054"
                />
                <Path
                    fill={color}
                    d="M6.664 8.923a.75.75 0 0 1 1.053.12a4.75 4.75 0 0 1 .026 5.881a.75.75 0 1 1-1.182-.923a3.25 3.25 0 0 0-.018-4.024a.75.75 0 0 1 .12-1.054"
                />
            </G>
        </Svg>
    );
};

export default ArrowDownIcon;
