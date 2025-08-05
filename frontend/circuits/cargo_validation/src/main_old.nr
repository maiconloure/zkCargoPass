// Circuit to verify if the sum of individual values of all items is equal to the total amount declared
// Based on example: NCM items total should equal $44,000
fn main(
    quantity1: u64, 
    unit_value1: u64,
    quantity2: u64,
    unit_value2: u64,
    total_declared_value: pub u64
) {
    let sum1 = quantity1 * unit_value1;
    let sum2 = quantity2 * unit_value2;
    let total_sum = sum1 + sum2;

    let difference = if total_sum > total_declared_value { 
        total_sum - total_declared_value 
    } else { 
        total_declared_value - total_sum 
    };

    assert(difference <= 1);
}

#[test]
fn test_main() {
    // Test with consistent amount declared for the total values of the items
    let unity_value = 500;
    let quantity = 200;
    let total_declared_value = 100000;
    
    main(unity_value, quantity, total_declared_value);
}

#[test(should_fail)]
fn test_main_smaller_value_declared() {
    // Test with amount declared smaller than total value of the items
    let unity_value = 500;
    let quantity = 200;
    let total_declared_value = 80000;
    
    main(unity_value, quantity, total_declared_value);
}

#[test]
fn test_main_diff_1_cent() {
    // Test with amount declared within the range of 1 cent for total value of the items
    let unity_value = 500;
    let quantity = 200;
    let total_declared_value = 100001;

    main(unity_value, quantity, total_declared_value);
}

#[test(should_fail)]
fn test_main_diff_2_cent() {
    // Test with amount declared outside of the range of 1 cent for total value of the items
    let unity_value = 500;
    let quantity = 200;
    let total_declared_value = 100002;

    main(unity_value, quantity, total_declared_value);
}