// Circuit to verify cargo values match declared totals
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
    
    assert(total_sum == total_declared_value);
}

#[test]  
fn test_example_data() {
    main(100, 400, 200, 20, 44000);
}
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